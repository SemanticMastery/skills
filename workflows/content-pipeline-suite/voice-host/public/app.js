/* Owner interview page. textContent only. No HTML injection. */
(function () {
  const sessionId =
    document.querySelector("[data-session-id]")?.getAttribute("data-session-id") ||
    location.pathname.split("/").filter(Boolean).pop() ||
    "";
  let pageToken = "";
  let tapQuestionId = null;
  let pollTimer = null;
  let connectTimer = null;
  let live = false;

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value || "";
  }

  function setLive(on) {
    live = Boolean(on);
    const node = el("live");
    if (node) node.hidden = !live;
  }

  function clearConnectTimer() {
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  }

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function wrapFetch(baseFetch) {
    return async function (input, init) {
      const original = requestUrl(input);
      if (/\/v3\/create-web-call\/?(\?|$)/.test(original)) {
        const headers = new Headers(init && init.headers);
        headers.set("X-Session-Id", sessionId);
        init = { ...(init || {}), headers };
        input = `${location.origin}/v3/create-web-call`;
      }
      const response = await baseFetch(input, init);
      const token = response.headers.get("X-Page-Token");
      if (token) pageToken = token;
      return response;
    };
  }

  async function pollQuestion() {
    if (!pageToken) return;
    const response = await fetch("/q", {
      headers: { "X-Page-Token": pageToken, "X-Session-Id": sessionId },
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.status === "connecting") setText("status", "Connecting…");
    else if (data.status === "consent_pending") {
      setText("status", "the interviewer will ask your permission to record");
      setText("card", "");
    } else if (data.status === "call_active") {
      setText("status", "the call is live elsewhere — close this tab");
    } else if (data.status === "expired" || data.status === "start_cap") {
      setText("status", "this link is no longer usable");
    } else if (data.status === "dropped" || data.status === "ended_early") {
      setText("status", "call ended — press Start to continue");
      setText("phase", "");
      setLive(false);
      const start = el("start");
      if (start) start.disabled = false;
    } else if (data.current && data.current.prompt) {
      const n = data.current_index;
      const total = data.question_count;
      setText("status", n && total ? `Question ${n} of ${total}` : "Interview in progress");
      setText("card", data.current.prompt);
    } else if (data.status === "in_progress") {
      setText("status", "Interview in progress");
    } else if (data.finished) {
      setText("status", "This interview is finished.");
      setText("phase", "");
      setText("card", "");
      setLive(false);
    }
    const taps = el("taps");
    if (taps) taps.hidden = !data.tap_open;
    tapQuestionId = data.tap_question_id || data.window_publish_id || null;
  }

  async function sendTap(value) {
    if (!pageToken || !tapQuestionId) return;
    const response = await fetch("/tap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Page-Token": pageToken,
        "X-Session-Id": sessionId,
      },
      body: JSON.stringify({ question_id: tapQuestionId, value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error === "tap_rejected") setText("status", "tell the interviewer");
    else setText("phase", data.value || value);
  }

  function startCall() {
    const start = el("start");
    if (agentKind() === "voice" && !alreadyReleased()) {
      setText("status", "type your name to confirm");
      if (start) start.disabled = false;
      return;
    }
    if (start) start.disabled = true;
    setLive(false);
    setText("phase", "");
    setText("status", "Connecting…");
    const Client = window.RetellClient || window.RetellWebClient;
    if (!Client) {
      setText("status", "Interview page is missing the voice client.");
      if (start) start.disabled = false;
      return;
    }
    // Do not set baseURL to this Worker: gateway signaling is
    // `${baseURL}/webrtc-proxy/...` and LiveKit is wss://*.livekit.cloud.
    // wrapFetch sends only POST /v3/create-web-call to the Worker.
    const client = new Client({
      key: "proxy",
      fetch: wrapFetch(window.fetch.bind(window)),
    });
    let wentLive = false;
    let startFailed = false;
    clearConnectTimer();
    connectTimer = setTimeout(() => {
      if (live) return;
      setText("status", "Still connecting. Check the microphone, then press Start again.");
      if (start) start.disabled = false;
    }, 25000);
    try {
      client.createWebCall({
        extra: { session_id: sessionId },
        hooks: {
          onStatus: (status) => {
            if (status === "live") {
              wentLive = true;
              clearConnectTimer();
              setLive(true);
              setText("status", "Connected");
              setText("phase", "the interviewer will start shortly");
            }
          },
          onAgentStartTalking: () => setText("phase", "Interviewer speaking"),
          onAgentStopTalking: () => setText("phase", "Your turn"),
          onError: (err) => {
            startFailed = true;
            onConnectError(err);
          },
          onEnd: () => {
            clearConnectTimer();
            setLive(false);
            if (!wentLive || startFailed) return;
            setText("phase", "");
            setText("status", "call ended — press Start to continue");
            if (start) start.disabled = false;
          },
        },
      });
      if (!pollTimer) pollTimer = setInterval(pollQuestion, 800);
      pollQuestion();
    } catch (err) {
      onConnectError(err);
    }
  }

  function onConnectError(err) {
    clearConnectTimer();
    setLive(false);
    const start = el("start");
    const message = String((err && (err.message || err.name)) || err || "");
    const code = String((err && err.body && (err.body.error || err.body.message)) || message);
    if (/permission|notallowed|notallowederror|microphone/i.test(message)) {
      setText("status", "allow the microphone, then press Start again");
    } else if (/call_active/i.test(code)) {
      setText("status", "the call is live elsewhere — close this tab");
    } else if (/release_required/i.test(code)) {
      setText("status", "type your name to confirm");
    } else if (/expired|start_cap/i.test(code)) {
      setText("status", "this link is no longer usable");
    } else {
      setText("status", "Could not start the interview. Press Start again.");
    }
    if (start) start.disabled = false;
  }

  function agentKind() {
    return document.querySelector("[data-agent-kind]")?.getAttribute("data-agent-kind") || "owner";
  }

  function alreadyReleased() {
    return document.querySelector("[data-released]")?.getAttribute("data-released") === "1";
  }

  function setVoiceReleaseUi(released) {
    const releaseBox = el("release");
    const start = el("start");
    const taps = el("taps");
    if (releaseBox) releaseBox.hidden = released;
    if (start) start.hidden = !released;
    if (taps) taps.hidden = true;
  }

  async function confirmRelease() {
    const input = el("release-name");
    const name = input && "value" in input ? String(input.value || "").trim() : "";
    if (!name) {
      setText("status", "type your name to confirm");
      return;
    }
    const response = await fetch("/release", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setText("status", data.error === "release_name_required" ? "type your name to confirm" : "Could not confirm. Try again.");
      return;
    }
    const main = document.querySelector("[data-released]");
    if (main) main.setAttribute("data-released", "1");
    setVoiceReleaseUi(true);
    setText("status", "Press Start when you are ready.");
  }

  function bind() {
    const start = el("start");
    if (start) start.addEventListener("click", startCall);
    document.querySelectorAll("[data-tap]").forEach((button) => {
      button.addEventListener("click", () => sendTap(button.getAttribute("data-tap")));
    });
    const confirm = el("release-confirm");
    if (confirm) confirm.addEventListener("click", confirmRelease);
    if (agentKind() === "voice") setVoiceReleaseUi(alreadyReleased());
  }

  window.OwnerInterviewPage = {
    wrapFetch,
    getPageToken: () => pageToken,
    setPageToken: (value) => {
      pageToken = value;
    },
    pollQuestion,
    sendTap,
    startCall,
    onConnectError,
    sessionId,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
