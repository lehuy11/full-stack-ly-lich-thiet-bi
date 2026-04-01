import defaultData from "../data/data.json";
import { apiRequest } from "./api";
import {
  getBranchOptionsByEnterprise,
  getEnterpriseOptions,
  getStationsForEnterpriseBranch,
  inferEnterpriseFromBranch,
  normalizeBranchName,
  normalizeEnterpriseName,
  normalizeLookup,
} from "./organization";

export const SYSTEMS_UPDATED_EVENT = "t3h-systems-updated";

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStationName(value = "") {
  return normalizeText(value)
    .replace(/^hệ\s*thống\s*ttth\s*ga\s+/i, "")
    .replace(/^ga\s+/i, "");
}

function isEnterpriseNode(item) {
  return Boolean(item && typeof item === "object" && item.name_enterprise && Array.isArray(item.children));
}

function isBranchNode(item) {
  return Boolean(item && typeof item === "object" && item.name_branch && Array.isArray(item.children));
}

function isSystemNode(item) {
  return Boolean(item && typeof item === "object" && item.name_system && Array.isArray(item.children));
}

function getSystemTemplateChildren() {
  const firstSystemChildren = defaultData?.[0]?.children?.[0]?.children;
  return cloneData(Array.isArray(firstSystemChildren) ? firstSystemChildren : []);
}

function makeNumericId(items = []) {
  const maxId = items.reduce((maxValue, item) => {
    const parsed = Number(item?.id);
    return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
  }, 0);
  return String(maxId + 1);
}

function createSystemNode(stationName, existingSystems = []) {
  return {
    id: makeNumericId(existingSystems),
    name_system: `Hệ thống TTTH ga ${normalizeStationName(stationName)}`,
    children: getSystemTemplateChildren(),
  };
}

function createDefaultOrganizationsData() {
  return getEnterpriseOptions().map((enterpriseName, enterpriseIndex) => ({
    id: String(enterpriseIndex + 1),
    name_enterprise: enterpriseName,
    children: getBranchOptionsByEnterprise(enterpriseName).map((branchName, branchIndex) => ({
      id: String(branchIndex + 1),
      name_branch: branchName,
      children: getStationsForEnterpriseBranch(enterpriseName, branchName).map((stationName, stationIndex, stations) => ({
        ...createSystemNode(stationName, stations.slice(0, stationIndex)),
        id: String(stationIndex + 1),
      })),
    })),
  }));
}

function normalizeSystemNode(system = {}) {
  return {
    id: String(system.id || ""),
    name_system: `Hệ thống TTTH ga ${normalizeStationName(system.name_system || system.name || "")}`,
    children: Array.isArray(system.children) ? cloneData(system.children) : [],
  };
}

function normalizeBranchNode(branch = {}) {
  return {
    id: String(branch.id || ""),
    name_branch: normalizeBranchName(branch.name_branch || branch.name || ""),
    children: Array.isArray(branch.children) ? branch.children.filter(isSystemNode).map(normalizeSystemNode) : [],
  };
}

function normalizeEnterpriseNode(enterprise = {}) {
  return {
    id: String(enterprise.id || ""),
    name_enterprise: normalizeEnterpriseName(enterprise.name_enterprise || enterprise.name || ""),
    children: Array.isArray(enterprise.children) ? enterprise.children.filter(isBranchNode).map(normalizeBranchNode) : [],
  };
}

function mergeOrganizations(baseOrganizations = [], incomingOrganizations = []) {
  const next = cloneData(baseOrganizations);

  (incomingOrganizations || []).forEach((enterprise) => {
    const enterpriseName = normalizeEnterpriseName(enterprise?.name_enterprise || enterprise?.name || "");
    if (!enterpriseName) return;

    let enterpriseIndex = next.findIndex(
      (item) => normalizeLookup(item?.name_enterprise) === normalizeLookup(enterpriseName),
    );

    if (enterpriseIndex < 0) {
      next.push({ id: makeNumericId(next), name_enterprise: enterpriseName, children: [] });
      enterpriseIndex = next.length - 1;
    }

    const targetEnterprise = next[enterpriseIndex];
    targetEnterprise.children = Array.isArray(targetEnterprise.children) ? targetEnterprise.children : [];

    (enterprise.children || []).forEach((branch) => {
      const branchName = normalizeBranchName(branch?.name_branch || branch?.name || "");
      if (!branchName) return;

      let branchIndex = targetEnterprise.children.findIndex(
        (item) => normalizeLookup(item?.name_branch) === normalizeLookup(branchName),
      );
      if (branchIndex < 0) {
        targetEnterprise.children.push({ id: makeNumericId(targetEnterprise.children), name_branch: branchName, children: [] });
        branchIndex = targetEnterprise.children.length - 1;
      }

      const targetBranch = targetEnterprise.children[branchIndex];
      targetBranch.children = Array.isArray(targetBranch.children) ? targetBranch.children : [];

      (branch.children || []).forEach((system) => {
        const normalizedSystem = normalizeSystemNode(system);
        const stationName = normalizeStationName(normalizedSystem.name_system);
        const systemIndex = targetBranch.children.findIndex(
          (item) => normalizeLookup(normalizeStationName(item?.name_system)) === normalizeLookup(stationName),
        );
        if (systemIndex >= 0) {
          targetBranch.children[systemIndex] = normalizedSystem;
        } else {
          targetBranch.children.push({ ...normalizedSystem, id: normalizedSystem.id || makeNumericId(targetBranch.children) });
        }
      });
    });
  });

  return next;
}

export function normalizeOrganizationsData(rawData) {
  const safeRawData = Array.isArray(rawData) ? rawData : [];
  const defaultOrganizations = createDefaultOrganizationsData();

  if (safeRawData.every(isEnterpriseNode)) {
    return mergeOrganizations(defaultOrganizations, safeRawData.map(normalizeEnterpriseNode));
  }

  if (safeRawData.every(isBranchNode)) {
    const migratedOrganizations = safeRawData.reduce((accumulator, branch) => {
      const normalizedBranch = normalizeBranchNode(branch);
      const enterpriseName = inferEnterpriseFromBranch(normalizedBranch.name_branch) || getEnterpriseOptions()[0];
      let enterprise = accumulator.find(
        (item) => normalizeLookup(item.name_enterprise) === normalizeLookup(enterpriseName),
      );
      if (!enterprise) {
        enterprise = { id: makeNumericId(accumulator), name_enterprise: enterpriseName, children: [] };
        accumulator.push(enterprise);
      }
      enterprise.children.push(normalizedBranch);
      return accumulator;
    }, []);

    return mergeOrganizations(defaultOrganizations, migratedOrganizations);
  }

  return defaultOrganizations;
}

function dispatchSystemsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYSTEMS_UPDATED_EVENT));
  }
}

export async function loadBranchesData() {
  try {
    const result = await apiRequest("/branches/tree");
    return normalizeOrganizationsData(result.data || []);
  } catch (error) {
    console.error("Không đọc được dữ liệu hệ thống từ API", error);
    return createDefaultOrganizationsData();
  }
}

export async function saveBranchesData(branches = []) {
  const normalized = normalizeOrganizationsData(branches);
  try {
    const result = await apiRequest("/branches/tree", {
      method: "PUT",
      body: { branches: normalized },
    });
    dispatchSystemsUpdated();
    return normalizeOrganizationsData(result.data || normalized);
  } catch (error) {
    console.error("Không lưu được dữ liệu hệ thống", error);
    throw error;
  }
}

export async function getOrganizationsData() {
  return loadBranchesData();
}

export async function getEnterpriseNames() {
  const organizations = await loadBranchesData();
  return organizations.map((enterprise) => enterprise?.name_enterprise).filter(Boolean);
}

export async function getBranchNamesByEnterprise(enterpriseName = "") {
  const organizations = await loadBranchesData();
  const normalizedEnterprise = normalizeEnterpriseName(enterpriseName);
  const enterprise = organizations.find((item) => item?.name_enterprise === normalizedEnterprise);
  return (enterprise?.children || []).map((branch) => branch?.name_branch).filter(Boolean);
}

export async function resetBranchesData() {
  const freshData = createDefaultOrganizationsData();
  await saveBranchesData(freshData);
  return freshData;
}

export function getVisibleOrganizations(organizations = [], user = null) {
  const normalized = normalizeOrganizationsData(organizations);

  if (!user || user?.role === "admin") {
    return normalized;
  }

  const enterpriseName = normalizeEnterpriseName(user.enterprise || inferEnterpriseFromBranch(user.branch || ""));
  const branchName = normalizeBranchName(user.branch || "");

  return normalized
    .filter((enterprise) => !enterpriseName || enterprise?.name_enterprise === enterpriseName)
    .map((enterprise) => ({
      ...enterprise,
      children: (enterprise.children || []).filter((branch) => !branchName || branch?.name_branch === branchName),
    }))
    .filter((enterprise) => (enterprise.children || []).length > 0);
}

export { normalizeBranchName, normalizeEnterpriseName };
