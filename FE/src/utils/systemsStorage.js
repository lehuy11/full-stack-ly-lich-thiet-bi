import defaultData from "../data/data.json";
import { apiRequest } from "./api";

export const SYSTEMS_UPDATED_EVENT = "t3h-systems-updated";
export const DEFAULT_BRANCH_NAME = "Cung Sài Gòn";

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function isBranchNode(item) {
  return Boolean(item && typeof item === "object" && item.name_branch && Array.isArray(item.children));
}

function isSystemNode(item) {
  return Boolean(item && typeof item === "object" && item.name_system);
}

function getDefaultBranches() {
  return cloneData(Array.isArray(defaultData) ? defaultData : []);
}

function normalizeText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeBranchName(value = "") {
  const cleaned = normalizeText(value);
  if (!cleaned) return "";
  if (/^cung\s+/i.test(cleaned)) {
    return cleaned.replace(/^cung\s+/i, "Cung ");
  }
  return `Cung ${cleaned}`;
}

function normalizeBranchNode(branch = {}) {
  return {
    id: String(branch.id || ""),
    name_branch: normalizeBranchName(branch.name_branch || branch.name || ""),
    children: Array.isArray(branch.children) ? branch.children.map(normalizeNode) : [],
  };
}

function normalizeSystemNode(system = {}) {
  return {
    id: String(system.id || ""),
    name_system: String(system.name_system || system.name || "").trim(),
    children: Array.isArray(system.children) ? system.children.map(normalizeNode) : [],
  };
}

function normalizeNode(node = {}) {
  if (isBranchNode(node)) return normalizeBranchNode(node);
  if (isSystemNode(node)) return normalizeSystemNode(node);

  if (Array.isArray(node.children)) {
    return {
      ...node,
      id: String(node.id || ""),
      name: String(node.name || "").trim(),
      children: node.children.map(normalizeNode),
    };
  }

  return {
    ...node,
    id: String(node.id || ""),
    name: String(node.name || "").trim(),
    code: String(node.code || ""),
    material: String(node.material || ""),
    number: String(node.number || ""),
    year: String(node.year || ""),
    expired: String(node.expired || ""),
    status: String(node.status || ""),
    unit: String(node.unit || ""),
    note: String(node.note || ""),
  };
}

export function normalizeBranchesData(rawData) {
  if (!Array.isArray(rawData)) {
    return getDefaultBranches();
  }

  const branchNodes = rawData.filter(isBranchNode).map(normalizeBranchNode);
  return branchNodes.length > 0 ? branchNodes : getDefaultBranches();
}

function dispatchSystemsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYSTEMS_UPDATED_EVENT));
  }
}

export async function loadBranchesData() {
  try {
    const result = await apiRequest("/branches/tree");
    return normalizeBranchesData(result.data || []);
  } catch (error) {
    console.error("Không đọc được dữ liệu hệ thống từ API", error);
    return getDefaultBranches();
  }
}

export async function saveBranchesData(branches = []) {
  const normalized = normalizeBranchesData(branches);
  try {
    const result = await apiRequest("/branches/tree", {
      method: "PUT",
      body: { branches: normalized },
    });
    return normalizeBranchesData(result.data || normalized);
  } catch (error) {
    console.error("Không lưu được dữ liệu hệ thống", error);
    throw error;
  }
}

export async function ensureBranchStructure(branchName, rawStations) {
  const branches = await loadBranchesData();
  const normalizedBranchName = normalizeBranchName(branchName);
  if (!normalizedBranchName) {
    return { success: false, message: "Tên cung không được để trống." };
  }

  const stationNames = String(rawStations || "")
    .split(/\r?\n|,|;/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (stationNames.length === 0) {
    return { success: false, message: "Phải nhập ít nhất một ga cho cung đó." };
  }

  const existing = branches.find((item) => item.name_branch === normalizedBranchName);
  const nextBranches = cloneData(branches);
  const targetBranch = existing || { id: String(nextBranches.length + 1), name_branch: normalizedBranchName, children: [] };
  const seenStations = new Set((targetBranch.children || []).map((item) => item.name_system));
  const addedStations = [];

  stationNames.forEach((stationName, index) => {
    const formattedName = `Hệ thống TTTH ga ${stationName.replace(/^Hệ\s*thống\s*TTTH\s*ga\s+/i, "").replace(/^ga\s+/i, "")}`;
    if (!seenStations.has(formattedName)) {
      targetBranch.children.push({
        id: String(targetBranch.children.length + index + 1),
        name_system: formattedName,
        children: cloneData(getDefaultBranches()[0]?.children?.[0]?.children || []),
      });
      addedStations.push(stationName);
      seenStations.add(formattedName);
    }
  });

  if (!existing) {
    nextBranches.push(targetBranch);
  }

  await saveBranchesData(nextBranches);
  return {
    success: true,
    branchName: normalizedBranchName,
    addedStations,
    branches: nextBranches,
  };
}

export async function getBranchNames() {
  const branches = await loadBranchesData();
  return branches.map((branch) => branch?.name_branch).filter(Boolean);
}

export async function resetBranchesData() {
  const freshData = getDefaultBranches();
  await saveBranchesData(freshData);
  return freshData;
}

export function getVisibleBranches(branches = [], user = null) {
  const normalized = normalizeBranchesData(branches);

  if (!user?.branch || user?.role === "admin") {
    return normalized;
  }

  return normalized.filter((branch) => branch?.name_branch === user.branch);
}

export function getVisibleSystems(branch = null) {
  if (!branch?.children || !Array.isArray(branch.children)) return [];
  return branch.children;
}
