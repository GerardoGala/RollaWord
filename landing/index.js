// ==========================================================
// LAUNCHING & LANDING LESSON
// ==========================================================

let lessons = [];
let currentLesson = 0;


// ==========================================================
// ELEMENTS
// ==========================================================

const video = document.getElementById("lessonVideo");
const videoSource = document.getElementById("videoSource");

const windLabel = document.getElementById("windLabel");
const videoTitle = document.getElementById("videoTitle");
const videoDescription = document.getElementById("videoDescription");
const progressText = document.getElementById("progressText");

const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");

const completionMessage = document.getElementById("completionMessage");


// ==========================================================
// LOAD LESSON DATA
// ==========================================================

async function loadLessons() {

  try {

    const response = await fetch("lessons.json");

    if (!response.ok) {
      throw new Error("Unable to load lessons.json");
    }

    const data = await response.json();

    lessons = data.lessons;

    if (!lessons || lessons.length === 0) {
      throw new Error("No lessons found.");
    }

    showLesson(0);

  } catch (error) {

    console.error("Lesson loading error:", error);

    videoTitle.textContent = "Unable to load lesson";
    videoDescription.textContent =
      "The lesson content could not be loaded. Please refresh the page.";

  }

}


// ==========================================================
// SHOW LESSON INFORMATION
// ==========================================================

function showLesson(index) {

  currentLesson = index;

  const lesson = lessons[currentLesson];

  // Stop the current video.
  video.pause();

  // Remove the current video source.
  video.removeAttribute("src");
  videoSource.removeAttribute("src");

  // Reset the video element.
  video.load();

  // Update lesson information.
  windLabel.textContent = lesson.wind;
  videoTitle.textContent = lesson.title;
  videoDescription.textContent = lesson.description;

  progressText.textContent =
    `${currentLesson + 1} / ${lessons.length}`;

  // Update navigation buttons.
  previousButton.disabled = currentLesson === 0;

  if (currentLesson === lessons.length - 1) {

    nextButton.innerHTML = `
      <span class="d-none d-sm-inline">
        Finish
      </span>
      <i class="bi bi-check-lg"></i>
    `;

  } else {

    nextButton.innerHTML = `
      <span class="d-none d-sm-inline">
        Next
      </span>
      <i class="bi bi-arrow-right"></i>
    `;
  }

  // Hide completion message when navigating.
  completionMessage.style.display = "none";

  // Make sure the video area is visible.
  video.style.display = "block";
}


// ==========================================================
// LOAD VIDEO ONLY WHEN NEEDED
// ==========================================================

function loadCurrentVideo() {

  const lesson = lessons[currentLesson];

  // Don't reload if the video is already loaded.
  if (videoSource.src || video.currentSrc) {
    return;
  }

  videoSource.src = lesson.video;

  // Tell the browser that a new source is available.
  video.load();
}


// ==========================================================
// PLAY EVENT
// ==========================================================
//
// The first click on Play loads the video.
// This prevents all six videos from being downloaded
// when the page initially opens.
//

video.addEventListener("play", function () {

  if (!videoSource.src) {

    loadCurrentVideo();

    // The play request occurred before the source was loaded.
    // Start playback once the video is ready.
    video.addEventListener(
      "loadeddata",
      function () {
        video.play().catch(() => {});
      },
      { once: true }
    );

  }

});


// ==========================================================
// NEXT
// ==========================================================

nextButton.addEventListener("click", function () {

  if (currentLesson < lessons.length - 1) {

    showLesson(currentLesson + 1);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } else {

    // Final lesson completed.
    video.pause();

    video.style.display = "none";

    completionMessage.style.display = "block";

    nextButton.disabled = true;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }

});


// ==========================================================
// PREVIOUS
// ==========================================================

previousButton.addEventListener("click", function () {

  if (currentLesson > 0) {

    showLesson(currentLesson - 1);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }

});


// ==========================================================
// START
// ==========================================================

loadLessons();