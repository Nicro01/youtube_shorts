from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import yt_dlp
import os
import shutil
import zipfile
from moviepy.video.io.VideoFileClip import VideoFileClip

# Configuração do Bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Criação do aplicativo FastAPI
app = FastAPI(title="YouTube Shorts Downloader API", description="API para baixar vídeos de Shorts do YouTube", version="1.0")

# CORS
origins = ["http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Estrutura dos parâmetros esperados
class ShortsRequest(BaseModel):
    channel_url: str
    start_index: int
    end_index: int

# Armazenar progresso dos downloads e conversão
download_progress = {}

# Armazenar progresso da conversão
convertion_progress = {}

# Função para autenticação Bearer token
def authenticate(token: str = Depends(oauth2_scheme)):
    if token != "mysecrettoken":
        raise HTTPException(status_code=401, detail="Invalid or missing token")

# Função para buscar os links dos Shorts
def fetch_shorts_urls(channel_url: str):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': True,
        'playlistend': 1000
    }

    shorts_urls = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(channel_url, download=False)
            if 'entries' in info_dict:
                shorts_urls = [entry['url'] for entry in info_dict['entries'] if "/shorts/" in entry['url']]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Shorts URLs: {e}")

    return shorts_urls

# Função para converter vídeos para MP4
def convert_to_mp4(download_folder: str):
    download_progress['stage'] = "Converting to MP4"
    download_progress['converted'] = 0
    files = [f for f in os.listdir(download_folder) if f.endswith(('.mkv', '.webm'))]
    total_files = len(files)

    convertion_progress['total'] = total_files
    convertion_progress['stage'] = "Converting to MP4"
    convertion_progress['completed'] = 0
    
    for file in files:
        filepath = os.path.join(download_folder, file)
        mp4_filepath = os.path.splitext(filepath)[0] + ".mp4"

        # Converter usando moviepy
        try:
            with VideoFileClip(filepath) as clip:
                clip.write_videofile(mp4_filepath, codec="libx264")
            
            # Remover o arquivo original após a conversão
            os.remove(filepath)
            
            # Atualizar progresso de conversão
            convertion_progress['completed'] += 1
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to convert {file} to MP4. Error: {e}")

# Função para baixar os vídeos e gerar um arquivo ZIP
def download_shorts_and_create_zip(video_links: List[str], start_index: int, end_index: int, download_folder="youtube", zip_filename="shorts_videos.zip"):
    if not os.path.exists(download_folder):
        os.makedirs(download_folder)

    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': os.path.join(download_folder, '%(title)s.%(ext)s'),
        'quiet': True
    }

    selected_links = video_links[start_index:end_index]
    downloaded_videos = []

    # Resetar progresso de download
    total_videos = len(selected_links)
    download_progress['completed'] = 0
    download_progress['total'] = total_videos
    download_progress['stage'] = "Downloading"

    for link in selected_links:
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([link])
            downloaded_videos.append(link)
            # Atualizar progresso
            download_progress['completed'] += 1
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to download {link}. Error: {e}")

    # Converter os vídeos baixados para MP4
    convert_to_mp4(download_folder)

    # Criar arquivo ZIP com todos os vídeos baixados
    with zipfile.ZipFile(zip_filename, 'w') as zipf:
        for root, _, files in os.walk(download_folder):
            for file in files:
                zipf.write(os.path.join(root, file), file)

    # Limpar a pasta de downloads após criar o ZIP
    shutil.rmtree(download_folder)

    # Resetar progresso
    download_progress['stage'] = "Completed"
    return zip_filename

# Rota para buscar os links dos shorts
@app.post("/get-shorts", dependencies=[Depends(authenticate)])
def get_shorts(request: ShortsRequest):
    shorts_urls = fetch_shorts_urls(request.channel_url)
    if not shorts_urls:
        raise HTTPException(status_code=404, detail="No Shorts URLs found.")
    return {"shorts_urls": shorts_urls}

# Rota para download dos vídeos a partir dos índices fornecidos e gerar o arquivo ZIP
@app.post("/download-shorts", dependencies=[Depends(authenticate)])
def download_shorts(request: ShortsRequest, background_tasks: BackgroundTasks):
    shorts_urls = fetch_shorts_urls(request.channel_url)
    if not shorts_urls:
        raise HTTPException(status_code=404, detail="No Shorts URLs found.")
    if request.start_index < len(shorts_urls) and request.end_index <= len(shorts_urls):
        zip_filename = "shorts_videos.zip"
        background_tasks.add_task(download_shorts_and_create_zip, shorts_urls, request.start_index, request.end_index)
        return {"message": "Download started. Please check progress.", "download_link": f"/download/{zip_filename}"}
    else:
        raise HTTPException(status_code=400, detail=f"Invalid range. The channel has only {len(shorts_urls)} Shorts available.")

# Rota para verificar o progresso dos downloads
@app.get("/download-progress", dependencies=[Depends(authenticate)])
def get_download_progress():
    return download_progress

@app.get("/covertion-progress", dependencies=[Depends(authenticate)])
def get_convertion_progress():
    return convertion_progress

# Rota para download do arquivo ZIP gerado
@app.get("/download/{filename}")
def download_file(filename: str):
    if os.path.exists(filename):
        return FileResponse(path=filename, filename=filename, media_type='application/zip')
    else:
        raise HTTPException(status_code=404, detail="File not found.")
