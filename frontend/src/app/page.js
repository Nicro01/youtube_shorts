"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";

export default function Home() {
  const [channelUrl, setChannelUrl] = useState("");
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(10);
  const [popup, setPopup] = useState(false);
  const [maxAllowedShorts, setMaxAllowedShorts] = useState(30);
  const [maxShorts, setMaxShorts] = useState(0); // New state to hold the maximum number of shorts
  const [downloadProgress, setDownloadProgress] = useState({
    completed: 0,
    total: 0,
    stage: "",
  });
  const [convertionProgress, setConvertionProgress] = useState({
    completed: 0,
    total: 0,
    stage: "",
  });
  const [downloadLink, setDownloadLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false); // State to handle validation loading

  // Function to validate channel URL and get the max shorts count
  const validateChannelUrl = async () => {
    setValidating(true);
    try {
      const response = await axios.post(
        "http://localhost:8000/get-shorts",
        {
          channel_url: channelUrl,
          start_index: startIndex,
          end_index: endIndex,
        },
        {
          headers: {
            Authorization: `Bearer mysecrettoken`,
          },
        }
      );
      const shortsCount = response.data.shorts_urls.length;
      setMaxShorts(shortsCount);
      setEndIndex(shortsCount); // Optionally set endIndex to maxShorts initially
    } catch (error) {
      console.error("Error fetching shorts count", error);
    } finally {
      setValidating(false);
    }
  };

  // Effect to validate channel URL when it changes
  useEffect(() => {
    if (channelUrl) {
      validateChannelUrl();
    }
  }, [channelUrl]);

  // Function to initiate the download and conversion process
  const handleDownloadShorts = async () => {
    if (maxAllowedShorts < endIndex - startIndex) {
      setPopup(true);
      return;
    }
    setLoading(true);
    setDownloadProgress({});
    setConvertionProgress({});
    try {
      const response = await axios.post(
        "http://localhost:8000/download-shorts",
        {
          channel_url: channelUrl,
          start_index: startIndex,
          end_index: endIndex,
        },
        {
          headers: {
            Authorization: `Bearer mysecrettoken`,
          },
        }
      );
      setDownloadLink(response.data.download_link);

      // Monitor the download and conversion progress
      const interval = setInterval(async () => {
        const progressResponse = await axios.get(
          "http://localhost:8000/download-progress",
          {
            headers: {
              Authorization: `Bearer mysecrettoken`,
            },
          }
        );

        setDownloadProgress(progressResponse.data);

        let convertionResponse = {};

        if (progressResponse.data.stage === "Converting to MP4") {
          const convertionProgressResponse = await axios.get(
            "http://localhost:8000/covertion-progress",
            {
              headers: {
                Authorization: `Bearer mysecrettoken`,
              },
            }
          );
          convertionResponse = convertionProgressResponse.data;
          setConvertionProgress(convertionProgressResponse.data);
          console.log(convertionProgressResponse.data);
        }

        // Stop checking progress when the process is complete
        if (
          progressResponse.data.stage === "Completed" &&
          convertionResponse.completed === convertionResponse.total
        ) {
          setConvertionProgress(convertionResponse);
          setLoading(false);
          clearInterval(interval);
        }
      }, 1000);
    } catch (error) {
      console.error("Error downloading shorts", error);
      setLoading(false);
    }
  };

  return (
    <div className=" caveat select-none mx-auto p-4 min-h-screen bg-slate-100 text-slate-600 flex flex-col items-center justify-center">
      <div class="fixed left-0 top-0 h-screen w-screen">
        <Image
          src="/images/paperTexture.webp"
          width={1920}
          height={1080}
          draggable={false}
          className="h-full w-full object-cover"
          alt="Paper Texture"
        />
      </div>

      {popup && (
        <div
          className="fixed z-50 top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setPopup(false)}
        >
          <div
            className="bg-white h-[30vh] flex flex-col items-center justify-center relative appear p-8 rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg mb-4">
              The maximum allowed number of shorts is {maxAllowedShorts}.
            </p>
            <button
              className="absolute bottom-4 w-[95%] bg-purple-500 border-b-4 border-purple-700 hover:border-0 hover:translate-y-1 transition-all duration-100 ease-in-out text-white px-4 py-2 rounded-md"
              onClick={() => setPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <h1 className="text-5xl caveat-bold mb-12 bg-gradient-to-r from-purple-500 via-red-400 to-orange-400 bg-clip-text text-transparent">
        Xort Online Shorts Downloader
      </h1>

      <div className="w-full max-w-xl">
        <div className="mb-6 w-full max-w-xl relative">
          <Image
            src="/images/arrow.png"
            width={300}
            height={200}
            draggable={false}
            className="absolute -right-10 top-1/2 -translate-y-[80%] translate-x-full"
            alt="Picture of the author"
          />
          <label className="block mb-2">Channel URL</label>
          <input
            type="text"
            value={channelUrl}
            placeholder="https://www.youtube.com/@xort/shorts"
            onChange={(e) => setChannelUrl(e.target.value)}
            className="border p-2 rounded w-full shadow-lg"
          />
        </div>
        <div className="flex space-x-4 mb-6 w-full max-w-xl">
          <div className="flex-1 relative">
            <Image
              src="/images/arrow1.png"
              width={300}
              height={200}
              draggable={false}
              className="absolute  -left-10 top-1/2 -translate-y-1/4 -translate-x-full"
              alt="Picture of the author"
            />
            <label className="block mb-2">Start at</label>
            <input
              type="number"
              value={startIndex}
              onChange={(e) => setStartIndex(parseInt(e.target.value))}
              className="border shadow-lg p-2 rounded w-full"
              min={0}
              max={maxShorts - 1}
            />
          </div>
          <div className="flex-1 relative">
            <Image
              src="/images/arrow2.png"
              width={300}
              height={200}
              draggable={false}
              className="absolute -right-10 top-1/2 -translate-y-1/4 translate-x-full"
              alt="Picture of the author"
            />
            <label className="block mb-2">End at</label>
            <input
              type="number"
              value={endIndex}
              onChange={(e) => setEndIndex(parseInt(e.target.value))}
              className="border shadow-lg p-2 rounded w-full"
              min={startIndex + 1}
              max={maxShorts}
            />
          </div>
        </div>

        {loading || validating ? (
          <div className="w-full flex items-center justify-center">
            <div className="p-3 animate-spin drop-shadow-2xl bg-gradient-to-bl from-pink-400 via-purple-400 to-indigo-600 size-16 aspect-square rounded-full">
              <div className="rounded-full h-full w-full bg-slate-100 background-blur-md"></div>
            </div>
          </div>
        ) : (
          <div className="flex w-full rounded-xl z-20 relative bg-gradient-to-tr from-pink-300 to-blue-300 p-0.5 shadow-lg">
            <button
              onClick={handleDownloadShorts}
              disabled={
                loading ||
                validating ||
                !channelUrl ||
                startIndex >= endIndex ||
                endIndex > maxShorts
              }
              className="flex-1 font-bold text-xl bg-white px-6 py-3 rounded-xl"
            >
              Download {endIndex - startIndex} Shorts
            </button>
          </div>
        )}
      </div>

      {/* Display Download Progress */}
      {downloadProgress.stage && !convertionProgress.stage && (
        <div className="mt-4 w-full max-w-xl">
          <h2 className="text-xl font-semibold">
            Stage:{" "}
            {downloadProgress.stage === "Converting"
              ? "Transforming into MP4"
              : downloadProgress.stage}
          </h2>
          <p>
            {downloadProgress.completed}/{downloadProgress.total} completed
          </p>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
              <div
                style={{
                  width: `${
                    (downloadProgress.completed / downloadProgress.total) * 100
                  }%`,
                }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-tr from-pink-300 to-blue-300"
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Display Convertion Progress */}
      {convertionProgress.stage && (
        <div className="mt-4 w-full max-w-xl">
          <h2 className="text-xl font-semibold">Convertion Progress</h2>
          <p>
            {convertionProgress.completed}/{convertionProgress.total} completed
          </p>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
              <div
                style={{
                  width: `${
                    (convertionProgress.completed / convertionProgress.total) *
                    100
                  }%`,
                }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-tr from-pink-300 to-blue-300"
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Show Download Button when process is complete */}
      {downloadProgress.stage === "Completed" && downloadLink && (
        <div className="mt-6">
          <a
            draggable={false}
            href={`http://localhost:8000${downloadLink}`}
            className="bg-green-500 z-20 relative text-white px-6 py-3 rounded"
            download
          >
            Download Completed File
          </a>
        </div>
      )}
    </div>
  );
}
