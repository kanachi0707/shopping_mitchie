(function () {
  "use strict";

  var STORAGE_KEY = "mitchy-shopping-list-items";
  var HOLD_TO_DELETE_MS = 700;
  var DRAG_HOLD_MS = 240;
  var DRAG_CANCEL_DISTANCE = 12;

  var state = { items: [] };
  var deferredInstallPrompt = null;
  var dragState = null;

  var addForm = document.getElementById("add-form");
  var itemInput = document.getElementById("item-input");
  var listStage = document.getElementById("list-stage");
  var mitchieButton = document.getElementById("mitchie-button");
  var shoppingList = document.getElementById("shopping-list");
  var statusText = document.getElementById("status-text");
  var messageBubble = document.getElementById("message-bubble");
  var messageBubbleText = document.getElementById("message-bubble-text");
  var shareButton = document.getElementById("share-button");
  var installButton = document.getElementById("install-button");
  var clearAllButton = document.getElementById("clear-all-button");
  var clearCompletedButton = document.getElementById("clear-completed-button");
  var installDialog = document.getElementById("install-dialog");
  var installDialogBody = document.getElementById("install-dialog-body");
  var listItemTemplate = document.getElementById("list-item-template");
  var quickTabButtons = Array.prototype.slice.call(document.querySelectorAll("[data-tab-target]"));
  var quickTabPanels = Array.prototype.slice.call(document.querySelectorAll("[data-tab-panel]"));
  var feedbackMessage = "";
  var feedbackTimer = null;
  var lastMitchieMessageIndex = -1;
  var EMPTY_BUBBLE_MESSAGE = "（まだ空っぽだわ）";
  var SHARED_LINK_OPEN_MESSAGE = "このリストを見ながらお買い物しましょう";
  var openedFromSharedLink = false;
  var commonMitchieTapMessages = [
    "歩きスマホに気を付けてね",
    "ご近所さん見かけたらご挨拶してみる？",
    "お財布持ってきた？",
    "クーポン持った？",
    "食品の消費税は変わるのかな～",
    "マイバッグもった？",
    "あれ、切らしてたんじゃない？ほら、あれ。",
    "こないだの選挙、どうだった？",
    "物価高、なんとかしてほしいよね～",
    "今夜のこんだて何にする？",
    "最近、駐車券いらないところも増えてるよね",
    "ビニール袋も有料になって随分たつよね",
    "デザートも買っちゃわない？",
    "いつもは買わないものも試してみる？"
  ];
  var defaultMitchieTapMessages = [
    "おつかい、まかせたいものある？",
    "買い忘れ、ないか見てみよう",
    "左の線を長押しすると並べ替えできるよ",
    "共有リンクでお願いしやすくなるよ",
    "買い物頼みたいときは「買い物リストを送る」が便利！",
    "「定番をワンタップ追加」が便利よね～",
    "「アプリをホーム画面に追加」でスマホに登録する？",
    "帰ったら「みっちーめもぱず」やってみない？"
  ];
  var sharedLinkMitchieTapMessages = [
    "ひとつずつ見ながらで大丈夫",
    "買えたものから印をつけていこう",
    "迷ったらこのリストを見れば大丈夫",
    "ゆっくり確認しながら進めよう"
  ];

  function generateId() {
    return String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeItemName(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function getMaxOrder(items) {
    return items.reduce(function (maxValue, item) {
      return Math.max(maxValue, typeof item.order === "number" ? item.order : 0);
    }, -1);
  }

  function getMinOrder(items) {
    return items.reduce(function (minValue, item) {
      return Math.min(minValue, typeof item.order === "number" ? item.order : 0);
    }, 0);
  }

  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.createdAt - b.createdAt;
    });
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }

  function normalizeLoadedItems(items) {
    return items
      .filter(function (item) {
        return item && typeof item.name === "string";
      })
      .map(function (item, index) {
        return {
          id: typeof item.id === "string" ? item.id : "stored-" + index,
          name: normalizeItemName(item.name),
          done: Boolean(item.done),
          createdAt: typeof item.createdAt === "number" ? item.createdAt : index,
          order: typeof item.order === "number" ? item.order : index
        };
      })
      .filter(function (item) {
        return item.name.length > 0;
      });
  }

  function loadFromStorage() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return normalizeLoadedItems(parsed);
    } catch (error) {
      console.warn("localStorage からの復元に失敗しました。", error);
      return [];
    }
  }

  function encodeShareData(items) {
    return btoa(encodeURIComponent(JSON.stringify({
      i: items.map(function (item) {
        return item.done ? [item.name, 1] : item.name;
      })
    })));
  }

  function normalizeSharedItems(items, isCompactFormat) {
    return items
      .filter(function (item) {
        if (!item) {
          return false;
        }
        if (isCompactFormat) {
          return typeof item === "string" || (Array.isArray(item) && typeof item[0] === "string") || typeof item.n === "string";
        }
        return typeof item.name === "string";
      })
      .map(function (item, index) {
        var name;
        var done;

        if (isCompactFormat) {
          if (typeof item === "string") {
            name = item;
            done = 0;
          } else if (Array.isArray(item)) {
            name = item[0];
            done = item[1];
          } else {
            name = item.n;
            done = item.d;
          }
        } else {
          name = item.name;
          done = item.done;
        }

        return {
          id: generateId() + "-" + index,
          name: normalizeItemName(name),
          done: done === 1 || done === true,
          createdAt: index,
          order: index
        };
      })
      .filter(function (item) {
        return item.name.length > 0;
      });
  }

  function decodeShareData(encoded) {
    var parsed = JSON.parse(decodeURIComponent(atob(encoded)));
    var isCompactFormat = parsed && Array.isArray(parsed.i);
    var isLegacyFormat = parsed && Array.isArray(parsed.items);

    if (!isCompactFormat && !isLegacyFormat) {
      throw new Error("共有データの形式が不正です。");
    }

    return normalizeSharedItems(isCompactFormat ? parsed.i : parsed.items, isCompactFormat);
  }

  function getShareUrl() {
    var url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("data", encodeShareData(state.items));
    return url.toString();
  }

  function updateMessageBubble() {
    var total = state.items.length;
    var bubbleText = feedbackMessage || (total === 0 ? EMPTY_BUBBLE_MESSAGE : "");

    messageBubbleText.textContent = bubbleText;
    messageBubble.hidden = !bubbleText;
    listStage.classList.toggle("has-message", Boolean(bubbleText));
  }

  function setFeedback(message, options) {
    feedbackMessage = message || "";
    updateMessageBubble();

    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }

    if (feedbackMessage && (!options || options.persist !== true)) {
      feedbackTimer = window.setTimeout(function () {
        feedbackMessage = "";
        updateMessageBubble();
        feedbackTimer = null;
      }, options && typeof options.duration === "number" ? options.duration : 2600);
    }
  }

  function setPressSelectionLock(isLocked) {
    document.body.classList.toggle("is-pressing-action", Boolean(isLocked));
  }

  function updateMetaUrl() {
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute("content", window.location.href);
    }
  }

  function setQuickTab(tabName) {
    quickTabButtons.forEach(function (button) {
      var isActive = button.getAttribute("data-tab-target") === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    quickTabPanels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-tab-panel") !== tabName;
    });
  }

  function getNextMitchieMessage() {
    var modeMessages = openedFromSharedLink ? sharedLinkMitchieTapMessages : defaultMitchieTapMessages;
    var messagePool = commonMitchieTapMessages.concat(modeMessages);
    var nextIndex = Math.floor(Math.random() * messagePool.length);

    if (messagePool.length > 1 && nextIndex === lastMitchieMessageIndex) {
      nextIndex = (nextIndex + 1) % messagePool.length;
    }

    lastMitchieMessageIndex = nextIndex;
    return messagePool[nextIndex];
  }

  function handleMitchieTap() {
    if (feedbackMessage) {
      return;
    }

    setFeedback(getNextMitchieMessage(), {
      duration: 2800
    });
  }

  function commit(items, options) {
    state.items = items;
    saveToStorage();
    render();
    if (options && options.feedback) {
      setFeedback(options.feedback);
    }
  }

  function setupHoldToAction(button, action, options) {
    var holdTimer = null;
    var holdCompleted = false;
    var message = options && options.hint ? options.hint : "長押しで実行します。";

    function clearHoldVisual() {
      button.classList.remove("is-holding");
      button.style.removeProperty("--hold-duration");
    }

    function cancelHold() {
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      clearHoldVisual();
      setPressSelectionLock(false);
    }

    function completeHold() {
      holdTimer = null;
      holdCompleted = true;
      clearHoldVisual();
      setPressSelectionLock(false);
      action();
    }

    function startHold(event) {
      if (button.disabled || holdTimer !== null) {
        return;
      }
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      holdCompleted = false;
      button.classList.add("is-holding");
      button.style.setProperty("--hold-duration", HOLD_TO_DELETE_MS + "ms");
      setPressSelectionLock(true);
      holdTimer = window.setTimeout(completeHold, HOLD_TO_DELETE_MS);
    }

    button.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      startHold(event);
    });
    button.addEventListener("pointerup", cancelHold);
    button.addEventListener("pointerleave", cancelHold);
    button.addEventListener("pointercancel", cancelHold);
    button.addEventListener("blur", cancelHold);

    button.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        startHold();
      }
    });

    button.addEventListener("keyup", function (event) {
      if (event.key === " " || event.key === "Enter") {
        cancelHold();
      }
    });

    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (!holdCompleted && !button.disabled) {
        setFeedback(message);
      }
      holdCompleted = false;
    });
  }

  function pulseQuickAddButton(button) {
    button.classList.remove("is-added");
    void button.offsetWidth;
    button.classList.add("is-added");
    window.setTimeout(function () {
      button.classList.remove("is-added");
    }, 520);
  }

  function addItem(name, options) {
    var normalized = normalizeItemName(name);
    var shouldFocusInput = !options || options.focusInput !== false;

    if (!normalized) {
      setFeedback("項目名を入力してください。");
      if (shouldFocusInput) {
        itemInput.focus();
      }
      return;
    }

    var nextItems = state.items.concat({
      id: generateId(),
      name: normalized,
      done: false,
      createdAt: Date.now(),
      order: getMaxOrder(state.items) + 1
    });
    commit(nextItems, { feedback: "「" + normalized + "」を追加しました。" });
    itemInput.value = "";
    if (shouldFocusInput) {
      itemInput.blur();
    }
  }

  function toggleItem(id) {
    var nextItems = state.items.map(function (item) {
      if (item.id !== id) {
        return item;
      }
      return {
        id: item.id,
        name: item.name,
        done: !item.done,
        createdAt: item.createdAt,
        order: item.order
      };
    });
    commit(nextItems);
  }

  function removeItem(id) {
    var target = state.items.find(function (item) {
      return item.id === id;
    });
    commit(state.items.filter(function (item) {
      return item.id !== id;
    }), {
      feedback: target ? "「" + target.name + "」を削除しました。" : "項目を削除しました。"
    });
  }

  function clearCompleted() {
    commit(state.items.filter(function (item) {
      return !item.done;
    }), { feedback: "完了済みの項目を削除しました。" });
  }

  function clearAll() {
    commit([], { feedback: "すべての項目を削除しました。" });
  }

  function handleShare() {
    var shareUrl = getShareUrl();
    var shareData = {
      title: "買い物リスト | みっちー",
      text: "いまの買い物リストを共有します。",
      url: shareUrl
    };

    if (navigator.share) {
      navigator.share(shareData).then(function () {
        setFeedback("この共有リンクを送ってください", {
          duration: 4200
        });
      }).catch(function (error) {
        if (error && error.name !== "AbortError") {
          fallbackCopy(shareUrl);
        }
      });
      return;
    }
    fallbackCopy(shareUrl);
  }

  function fallbackCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setFeedback("この共有リンクを送ってください", {
          duration: 4200
        });
      }).catch(function () {
        manualCopy(text);
      });
      return;
    }
    manualCopy(text);
  }

  function manualCopy(text) {
    var tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, tempInput.value.length);
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    setFeedback("この共有リンクを送ってください", {
      duration: 4200
    });
  }

  function showDialog(html) {
    installDialogBody.innerHTML = html;
    if (typeof installDialog.showModal === "function") {
      installDialog.showModal();
      return;
    }
    alert(installDialogBody.textContent);
  }

  function isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isInStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function handleInstall() {
    if (isInStandaloneMode()) {
      showDialog("<p>すでにホーム画面から使える状態です。</p>");
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
      });
      return;
    }
    if (isIos()) {
      showDialog("<p>iPhone / iPad では次の順で追加できます。</p><ol><li>ブラウザ(Safari/Chromeなど)の共有ボタンをタップ</li><li>「ホーム画面に追加」を選ぶ（ない場合は「もっと見る」を押してみて）</li></ol>");
      return;
    }
    showDialog("<p>このブラウザでは直接インストールを出せませんでした。</p><p>ブラウザのメニューから「ホーム画面に追加」や「アプリをインストール」を探してみてください。</p>");
  }

  function cleanupDrag() {
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    document.removeEventListener("pointercancel", onDragEnd);
  }

  function getInsertBeforeElement(clientY) {
    var elements = Array.prototype.slice.call(shoppingList.querySelectorAll(".shopping-item:not(.shopping-item-placeholder)"));
    var closest = null;
    var closestOffset = Number.NEGATIVE_INFINITY;

    elements.forEach(function (element) {
      if (dragState && element === dragState.element) {
        return;
      }
      var box = element.getBoundingClientRect();
      var offset = clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = element;
      }
    });

    return closest;
  }

  function onDragMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    event.preventDefault();
    dragState.element.style.left = dragState.left + "px";
    dragState.element.style.top = event.clientY - dragState.offsetY + "px";

    var beforeElement = getInsertBeforeElement(event.clientY);
    if (beforeElement) {
      shoppingList.insertBefore(dragState.placeholder, beforeElement);
    } else {
      shoppingList.appendChild(dragState.placeholder);
    }
  }

  function applyDomOrder() {
    var ids = Array.prototype.slice.call(shoppingList.querySelectorAll(".shopping-item[data-id]"))
      .map(function (element) {
        return element.dataset.id;
      });

    var orderMap = {};
    ids.forEach(function (id, index) {
      orderMap[id] = index;
    });

    state.items = state.items.map(function (item) {
      return {
        id: item.id,
        name: item.name,
        done: item.done,
        createdAt: item.createdAt,
        order: Object.prototype.hasOwnProperty.call(orderMap, item.id) ? orderMap[item.id] : item.order
      };
    });

    saveToStorage();
    render();
  }

  function onDragEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    cleanupDrag();
    setPressSelectionLock(false);
    shoppingList.insertBefore(dragState.element, dragState.placeholder);
    dragState.placeholder.remove();

    dragState.element.classList.remove("is-dragging");
    dragState.element.style.position = "";
    dragState.element.style.left = "";
    dragState.element.style.top = "";
    dragState.element.style.width = "";
    dragState.element.style.zIndex = "";
    dragState.element.style.pointerEvents = "";
    dragState.handle.classList.remove("is-dragging");

    dragState = null;
    applyDomOrder();
  }

  function beginDrag(context) {
    var rect = context.listItem.getBoundingClientRect();
    var placeholder = document.createElement("li");
    placeholder.className = "shopping-item shopping-item-placeholder";
    placeholder.style.height = rect.height + "px";

    shoppingList.insertBefore(placeholder, context.listItem.nextSibling);
    document.body.appendChild(context.listItem);

    context.listItem.classList.add("is-dragging");
    context.handle.classList.remove("is-armed");
    context.handle.classList.add("is-dragging");

    context.listItem.style.position = "fixed";
    context.listItem.style.left = rect.left + "px";
    context.listItem.style.top = rect.top + "px";
    context.listItem.style.width = rect.width + "px";
    context.listItem.style.zIndex = "30";
    context.listItem.style.pointerEvents = "none";

    dragState = {
      pointerId: context.pointerId,
      element: context.listItem,
      placeholder: placeholder,
      handle: context.handle,
      offsetY: context.startY - rect.top,
      left: rect.left
    };

    document.addEventListener("pointermove", onDragMove, { passive: false });
    document.addEventListener("pointerup", onDragEnd);
    document.addEventListener("pointercancel", onDragEnd);
  }

  function setupDragHandle(handle, listItem) {
    var holdTimer = null;
    var pending = null;
    var dragStarted = false;

    function clearPending() {
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      handle.classList.remove("is-armed");
      setPressSelectionLock(false);
      pending = null;
    }

    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragStarted = false;
      pending = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        listItem: listItem,
        handle: handle
      };
      handle.classList.add("is-armed");
      setPressSelectionLock(true);
      holdTimer = window.setTimeout(function () {
        if (!pending) {
          return;
        }
        dragStarted = true;
        beginDrag(pending);
        clearPending();
      }, DRAG_HOLD_MS);
    });

    handle.addEventListener("pointermove", function (event) {
      if (!pending || pending.pointerId !== event.pointerId || dragStarted) {
        return;
      }
      if (Math.abs(event.clientX - pending.startX) > DRAG_CANCEL_DISTANCE || Math.abs(event.clientY - pending.startY) > DRAG_CANCEL_DISTANCE) {
        clearPending();
      }
    });

    handle.addEventListener("pointerup", function () {
      if (!dragStarted) {
        clearPending();
        setFeedback("左の3本線を長押しして並べ替えできます。");
      }
    });
    handle.addEventListener("pointercancel", clearPending);
    handle.addEventListener("pointerleave", function () {
      if (!dragStarted) {
        clearPending();
      }
    });
  }

  function render() {
    var items = sortItems(state.items);
    shoppingList.innerHTML = "";

    items.forEach(function (item) {
      var fragment = listItemTemplate.content.cloneNode(true);
      var listItem = fragment.querySelector(".shopping-item");
      var handle = fragment.querySelector(".drag-handle");
      var checkbox = fragment.querySelector(".item-checkbox");
      var text = fragment.querySelector(".item-text");
      var deleteButton = fragment.querySelector(".delete-button");

      listItem.dataset.id = item.id;
      checkbox.checked = item.done;
      checkbox.setAttribute("aria-label", item.done ? "未完了に戻す" : "完了にする");
      text.textContent = item.name;
      deleteButton.setAttribute("aria-label", item.name + " を削除");
      deleteButton.setAttribute("title", "長押しで削除");

      if (item.done) {
        listItem.classList.add("is-done");
      }

      checkbox.addEventListener("change", function () {
        toggleItem(item.id);
      });
      setupHoldToAction(deleteButton, function () {
        removeItem(item.id);
      }, {
        hint: "項目を削除するには長押ししてください。"
      });
      setupDragHandle(handle, listItem);

      shoppingList.appendChild(fragment);
    });

    var total = state.items.length;
    var completed = state.items.filter(function (item) {
      return item.done;
    }).length;
    statusText.textContent = total + "件中 " + completed + "件完了";
    statusText.classList.toggle("is-all-done", total > 0 && completed === total);
    listStage.classList.toggle("is-empty", total === 0);
    clearAllButton.disabled = total === 0;
    clearCompletedButton.disabled = completed === 0;
    updateMessageBubble();
  }

  function restoreFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var data = params.get("data");
    if (!data) {
      openedFromSharedLink = false;
      return false;
    }

    try {
      openedFromSharedLink = true;
      state.items = decodeShareData(data);
      saveToStorage();
      setFeedback(SHARED_LINK_OPEN_MESSAGE);
      return true;
    } catch (error) {
      openedFromSharedLink = false;
      console.warn("共有URLの復元に失敗しました。", error);
      setFeedback("共有URLの読み込みに失敗しました。");
      return false;
    }
  }

  function bindEvents() {
    addForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addItem(itemInput.value);
    });

    document.querySelectorAll("[data-quick-add]").forEach(function (button) {
      button.addEventListener("click", function () {
        addItem(button.getAttribute("data-quick-add") || "", {
          focusInput: false
        });
        pulseQuickAddButton(button);
      });
    });

    quickTabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setQuickTab(button.getAttribute("data-tab-target") || "food");
      });
    });

    setupHoldToAction(clearCompletedButton, clearCompleted, {
      hint: "完了済み削除は長押しで実行します。"
    });
    setupHoldToAction(clearAllButton, clearAll, {
      hint: "すべて削除は長押しで実行します。"
    });
    shareButton.addEventListener("click", handleShare);
    installButton.addEventListener("click", handleInstall);
    mitchieButton.addEventListener("click", handleMitchieTap);

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      installButton.hidden = false;
    });

    window.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      setFeedback("ホーム画面に追加されました。");
    });
  }

  function init() {
    updateMetaUrl();
    bindEvents();
    setQuickTab("food");
    if (!restoreFromUrl()) {
      state.items = loadFromStorage();
    }
    render();
  }

  init();
}());
