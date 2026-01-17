const STORAGE_KEY = "work-board-tasks";

const lists = {
  todo: document.getElementById("todo-list"),
  doing: document.getElementById("doing-list"),
  done: document.getElementById("done-list"),
};

const dialog = document.getElementById("task-dialog");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const dialogTitle = document.getElementById("dialog-title");
const cancelBtn = document.getElementById("cancel-btn");
const fileBtn = document.getElementById("file-btn");
const exportBtn = document.getElementById("export-btn");
const fileStatus = document.getElementById("file-status");

let tasks = normalizeTasks(loadTasks());
let currentStatus = "todo";
let editingTaskId = null;
let draggingTaskId = null;
let dragOverTaskId = null;
let fileHandle = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) {
    input.focus();
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) =>
      task.id === editingTaskId ? { ...task, content } : task
    );
  } else {
    const now = new Date().toISOString();
    const isDoing = currentStatus === "doing";
    const isDone = currentStatus === "done";
    tasks.unshift({
      id: crypto.randomUUID(),
      content,
      status: currentStatus,
      completed: isDone,
      createdAt: now,
      startedAt: isDoing ? now : null,
      completedAt: isDone ? now : null,
      doingTotalMs: 0,
      doingStartAt: isDoing ? now : null,
    });
  }

  await persistTasks();
  render();
  dialog.close();
});

cancelBtn.addEventListener("click", () => {
  dialog.close("cancel");
});

dialog.addEventListener("close", () => {
  input.value = "";
  editingTaskId = null;
});

function openNewTaskDialog(status) {
  currentStatus = status;
  editingTaskId = null;
  dialogTitle.textContent = `新增 ${status.toUpperCase()}`;
  input.value = "";
  dialog.showModal();
}

fileBtn.addEventListener("click", async () => {
  if (!window.showSaveFilePicker) {
    alert("当前浏览器不支持文件系统 API");
    return;
  }
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: "work-board.json",
      types: [
        {
          description: "JSON 文件",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    updateFileStatus();
    const fileTasks = normalizeTasks(await loadTasksFromFile());
    if (fileTasks.length > 0) {
      tasks = fileTasks;
    } else if (tasks.length > 0) {
      await persistTasks();
    }
    render();
  } catch (error) {
    console.warn("选择文件失败", error);
  }
});

exportBtn.addEventListener("click", async () => {
  if (!window.showSaveFilePicker) {
    alert("当前浏览器不支持文件系统 API");
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `work-summary-${formatDateKey(new Date())}.md`,
      types: [
        {
          description: "Markdown 文件",
          accept: { "text/markdown": [".md"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(buildMarkdown());
    await writable.close();
  } catch (error) {
    console.warn("导出 Markdown 失败", error);
  }
});

Object.entries(lists).forEach(([status, list]) => {
  list.addEventListener("dblclick", (event) => {
    if (event.target.closest(".task-card")) return;
    openNewTaskDialog(status);
  });

  list.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  list.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggingTaskId) return;
    void moveTaskToStatus(draggingTaskId, status);
    dragOverTaskId = null;
  });
});

document.querySelectorAll(".column").forEach((column) => {
  const status = column.dataset.status;
  column.addEventListener("dblclick", (event) => {
    if (event.target.closest(".task-card")) return;
    openNewTaskDialog(status);
  });
  column.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  column.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggingTaskId || !status) return;
    void moveTaskToStatus(draggingTaskId, status);
    dragOverTaskId = null;
  });
});

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function persistTasks() {
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(tasks, null, 2));
    await writable.close();
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function normalizeTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks.map((task) => ({
    ...task,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    doingTotalMs: Number.isFinite(task.doingTotalMs) ? task.doingTotalMs : 0,
    doingStartAt: task.doingStartAt ?? null,
  }));
}

async function loadTasksFromFile() {
  if (!fileHandle) return [];
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function updateFileStatus() {
  if (!fileStatus) return;
  if (!fileHandle) {
    fileStatus.textContent = "未选择文件";
    return;
  }
  fileStatus.textContent = `已连接：${fileHandle.name}`;
}

function render() {
  Object.values(lists).forEach((list) => {
    list.innerHTML = "";
  });

  const now = Date.now();
  const statusIndex = {
    todo: 0,
    doing: 0,
    done: 0,
  };
  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;
    card.addEventListener("dragstart", (event) => {
      draggingTaskId = task.id;
      card.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
      }
    });
    card.addEventListener("dragend", () => {
      draggingTaskId = null;
      dragOverTaskId = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      editTask(task.id);
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      dragOverTaskId = task.id;
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!draggingTaskId || draggingTaskId === task.id) return;
      void reorderTaskWithinStatus(draggingTaskId, task.id);
      dragOverTaskId = null;
    });

    const header = document.createElement("div");
    header.className = "task-header";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = task.completed ? "task-toggle done" : "task-toggle";
    toggle.textContent = task.completed ? "✓" : "";
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      void toggleTask(task.id);
    });

    const content = document.createElement("div");
    content.className = task.completed ? "task-content done" : "task-content";
    content.textContent = task.content;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-delete";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteTask(task.id);
    });

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const totalDoingMs =
      task.doingTotalMs +
      (task.doingStartAt ? now - Date.parse(task.doingStartAt) : 0);
    const startedText = task.startedAt
      ? new Date(task.startedAt).toLocaleString()
      : "-";
    const completedText = task.completedAt
      ? new Date(task.completedAt).toLocaleString()
      : "-";
    meta.textContent = `创建 ${new Date(
      task.createdAt
    ).toLocaleString()} ｜ 开始 ${startedText} ｜ 完成 ${completedText} ｜ Doing累计 ${formatDuration(
      totalDoingMs
    )}`;

    if (task.status === "doing" && statusIndex.doing === 0) {
      card.classList.add("highlight");
    }

    header.append(toggle, content, deleteBtn);
    card.append(header, meta);
    lists[task.status].appendChild(card);

    statusIndex[task.status] += 1;
  });
}

function editTask(id) {
  const target = tasks.find((task) => task.id === id);
  if (!target) return;
  editingTaskId = id;
  currentStatus = target.status;
  dialogTitle.textContent = `编辑 ${currentStatus.toUpperCase()}`;
  input.value = target.content;
  dialog.showModal();
}

async function moveTaskToStatus(id, status) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    let doingTotalMs = task.doingTotalMs ?? 0;
    let doingStartAt = task.doingStartAt;
    if (task.status === "doing" && doingStartAt) {
      doingTotalMs += Date.now() - Date.parse(doingStartAt);
      doingStartAt = null;
    }

    let startedAt = task.startedAt;
    if (status === "doing" && !startedAt) {
      startedAt = now;
    }
    if (status === "doing") {
      doingStartAt = now;
    }

    let completed = task.completed;
    let completedAt = task.completedAt ?? null;
    if (status === "done") {
      completed = true;
      completedAt = now;
    } else {
      completed = false;
      completedAt = null;
    }

    return {
      ...task,
      status,
      completed,
      completedAt,
      startedAt,
      doingTotalMs,
      doingStartAt,
    };
  });
  await persistTasks();
  render();
}

async function toggleTask(id) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    const nextCompleted = !task.completed;
    let status = nextCompleted ? "done" : "todo";
    let completedAt = nextCompleted ? now : null;
    let doingTotalMs = task.doingTotalMs ?? 0;
    let doingStartAt = task.doingStartAt;
    if (task.status === "doing" && doingStartAt) {
      doingTotalMs += Date.now() - Date.parse(doingStartAt);
      doingStartAt = null;
    }
    if (status === "doing") {
      doingStartAt = now;
    }
    return {
      ...task,
      completed: nextCompleted,
      status,
      completedAt,
      doingTotalMs,
      doingStartAt,
    };
  });
  await persistTasks();
  render();
}

async function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  await persistTasks();
  render();
}

async function reorderTaskWithinStatus(dragId, targetId) {
  const dragTask = tasks.find((task) => task.id === dragId);
  const targetTask = tasks.find((task) => task.id === targetId);
  if (!dragTask || !targetTask || dragTask.status !== targetTask.status) {
    return;
  }
  const status = dragTask.status;
  const list = tasks.filter((task) => task.status === status);
  const others = tasks.filter((task) => task.status !== status);

  const dragIndex = list.findIndex((task) => task.id === dragId);
  const targetIndex = list.findIndex((task) => task.id === targetId);
  if (dragIndex === -1 || targetIndex === -1) return;

  const [moved] = list.splice(dragIndex, 1);
  list.splice(targetIndex, 0, moved);
  tasks = [...list, ...others];
  await persistTasks();
  render();
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function getWeekStart(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7; // Monday = 0
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekLabel(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDateKey(start)} ~ ${formatDateKey(end)}`;
}

function buildMarkdown() {
  const now = Date.now();
  const statuses = ["todo", "doing", "done"];
  const lines = [
    "# 工作记录",
    "",
    `导出时间：${new Date(now).toLocaleString()}`,
    "",
  ];

  statuses.forEach((status) => {
    lines.push(`## ${status.toUpperCase()}`);
    const byStatus = tasks.filter((task) => task.status === status);
    if (byStatus.length === 0) {
      lines.push("- （无）");
      lines.push("");
      return;
    }

    const grouped = new Map();
    byStatus.forEach((task) => {
      if (!task.startedAt) {
        const key = "未开始";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(task);
        return;
      }
      const label = getWeekLabel(new Date(task.startedAt));
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(task);
    });

    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
      if (a === "未开始") return 1;
      if (b === "未开始") return -1;
      const aStart = Date.parse(a.split(" ~ ")[0]);
      const bStart = Date.parse(b.split(" ~ ")[0]);
      return aStart - bStart;
    });

    sortedKeys.forEach((key) => {
      lines.push(`### ${key}`);
      const list = grouped.get(key) || [];
      list
        .slice()
        .sort((a, b) => {
          const aTime = a.startedAt ? Date.parse(a.startedAt) : 0;
          const bTime = b.startedAt ? Date.parse(b.startedAt) : 0;
          return aTime - bTime;
        })
        .forEach((task) => {
          const totalDoingMs =
            task.doingTotalMs +
            (task.doingStartAt ? now - Date.parse(task.doingStartAt) : 0);
          lines.push(`- ${task.content}`);
          lines.push(`  - 总时间：${formatDuration(totalDoingMs)}`);
        });
      lines.push("");
    });
  });

  return `${lines.join("\n")}\n`;
}

setInterval(() => {
  if (tasks.some((task) => task.doingStartAt)) {
    render();
  }
}, 30000);

updateFileStatus();
render();