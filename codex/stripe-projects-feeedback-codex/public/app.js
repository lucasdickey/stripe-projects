const state = {
  page: 1,
  totalPages: 1
};

const summaryGrid = document.querySelector("#summary-grid");
const summaryTotal = document.querySelector("#summary-total");
const feedbackRows = document.querySelector("#feedback-rows");
const pageIndicator = document.querySelector("#page-indicator");
const prevPageButton = document.querySelector("#prev-page");
const nextPageButton = document.querySelector("#next-page");
const formStatus = document.querySelector("#form-status");
const chatAnswer = document.querySelector("#chat-answer");
const chatMatches = document.querySelector("#chat-matches");

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function renderSummary(data) {
  summaryTotal.textContent = `${data.total} submissions`;

  if (data.topCategories.length === 0) {
    summaryGrid.innerHTML = `<article class="summary-card empty">
      <h3>No feedback yet</h3>
      <p>Submit the first suggestion to start the category summary.</p>
    </article>`;
    return;
  }

  summaryGrid.innerHTML = data.topCategories
    .map(
      (item) => `<article class="summary-card">
        <div class="summary-meta">
          <span>${item.count} mentions</span>
          <span>${item.examples.length} example${item.examples.length === 1 ? "" : "s"}</span>
        </div>
        <h3>${item.category}</h3>
        <p>${item.examples.map((example) => `#${example.id}: ${example.excerpt}`).join(" ")}</p>
      </article>`
    )
    .join("");
}

function renderRows(data) {
  state.totalPages = data.totalPages;
  pageIndicator.textContent = `Page ${data.page} of ${data.totalPages}`;
  prevPageButton.disabled = data.page <= 1;
  nextPageButton.disabled = data.page >= data.totalPages;

  if (data.rows.length === 0) {
    feedbackRows.innerHTML = `<tr><td colspan="5" class="empty-row">No submissions yet.</td></tr>`;
    return;
  }

  feedbackRows.innerHTML = data.rows
    .map(
      (row) => `<tr>
        <td>${row.id}</td>
        <td>${new Date(row.createdAt).toLocaleString()}</td>
        <td>${escapeHTML(row.message)}</td>
        <td>${row.twitterHandle ? escapeHTML(row.twitterHandle) : "—"}</td>
        <td>${row.agent ? escapeHTML(row.agent) : "—"}</td>
      </tr>`
    )
    .join("");
}

function renderChat(payload) {
  chatAnswer.textContent = payload.answer;
  chatAnswer.classList.remove("muted");

  if (!payload.matches || payload.matches.length === 0) {
    chatMatches.innerHTML = "";
    return;
  }

  chatMatches.innerHTML = payload.matches
    .map((match) => `<article class="match-card">
      <strong>#${match.id}</strong>
      <p>${escapeHTML(match.message || match.excerpt || "")}</p>
      <div class="match-meta">${match.twitterHandle || ""} ${match.agent || ""}</div>
    </article>`)
    .join("");
}

function escapeHTML(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadSummary() {
  const payload = await fetchJSON("/api/summary");
  renderSummary(payload);
}

async function loadRows(page = 1) {
  const payload = await fetchJSON(`/api/feedback?page=${page}`);
  state.page = payload.page;
  renderRows(payload);
}

document.querySelector("#feedback-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "Submitting...";

  try {
    const payload = await fetchJSON("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: document.querySelector("#message").value,
        twitterHandle: document.querySelector("#twitterHandle").value,
        agent: document.querySelector("#agent").value
      })
    });

    event.target.reset();
    formStatus.textContent = `Saved feedback #${payload.entry.id}.`;
    await loadSummary();
    await loadRows(1);
  } catch (error) {
    formStatus.textContent = error.message;
  }
});

document.querySelector("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  chatAnswer.textContent = "Searching feedback...";
  chatAnswer.classList.add("muted");

  try {
    const payload = await fetchJSON("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: document.querySelector("#question").value
      })
    });
    renderChat(payload);
  } catch (error) {
    chatAnswer.textContent = error.message;
    chatMatches.innerHTML = "";
  }
});

prevPageButton.addEventListener("click", () => {
  if (state.page > 1) {
    loadRows(state.page - 1);
  }
});

nextPageButton.addEventListener("click", () => {
  if (state.page < state.totalPages) {
    loadRows(state.page + 1);
  }
});

await loadSummary();
await loadRows();
