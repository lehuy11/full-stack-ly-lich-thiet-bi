function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeBranchName(value = '') {
  const cleaned = normalizeText(value);
  if (!cleaned) return '';
  if (/^cung\s+/i.test(cleaned)) {
    return cleaned.replace(/^cung\s+/i, 'Cung ');
  }
  return `Cung ${cleaned}`;
}

function normalizeStationName(value = '') {
  return normalizeText(value)
    .replace(/^hệ\s*thống\s*ttth\s*ga\s+/i, '')
    .replace(/^ga\s+/i, '');
}

function parseStationNames(rawStations) {
  if (Array.isArray(rawStations)) {
    return rawStations.map(normalizeStationName).filter(Boolean);
  }

  return String(rawStations || '')
    .split(/\r?\n|,|;/)
    .map(normalizeStationName)
    .filter(Boolean);
}

function makeNumericId(items = []) {
  const maxId = items.reduce((maxValue, item) => {
    const parsed = Number(item?.id);
    return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
  }, 0);

  return String(maxId + 1);
}

function getSystemChildrenTemplate(tree = []) {
  for (const branch of tree) {
    for (const system of branch?.children || []) {
      if (Array.isArray(system?.children) && system.children.length > 0) {
        return clone(system.children);
      }
    }
  }
  return [];
}

function createSystemNode(stationName, tree, existingSystems = []) {
  return {
    id: makeNumericId(existingSystems),
    name_system: `Hệ thống TTTH ga ${stationName}`,
    children: getSystemChildrenTemplate(tree),
  };
}

function ensureBranchStructure(branches = [], rawBranchName = '', rawStations = []) {
  const branchName = normalizeBranchName(rawBranchName);
  const stationNames = Array.from(new Set(parseStationNames(rawStations)));
  const nextBranches = clone(Array.isArray(branches) ? branches : []);

  if (!branchName) {
    return {
      success: false,
      message: 'Tên cung không được để trống.',
      branches: nextBranches,
      addedStations: [],
    };
  }

  if (stationNames.length === 0) {
    return {
      success: false,
      message: 'Phải nhập ít nhất một ga cho cung trưởng.',
      branches: nextBranches,
      addedStations: [],
    };
  }

  const existingBranchIndex = nextBranches.findIndex(
    (branch) => branch?.name_branch === branchName,
  );

  if (existingBranchIndex < 0) {
    nextBranches.push({
      id: makeNumericId(nextBranches),
      name_branch: branchName,
      children: stationNames.map((stationName, index) => ({
        ...createSystemNode(stationName, nextBranches, []),
        id: String(index + 1),
      })),
    });

    return {
      success: true,
      branches: nextBranches,
      branchName,
      addedStations: stationNames,
    };
  }

  const branch = nextBranches[existingBranchIndex];
  const existingStations = new Set(
    (branch?.children || [])
      .map((system) => normalizeStationName(system?.name_system || ''))
      .filter(Boolean),
  );

  const addedStations = [];
  stationNames.forEach((stationName) => {
    if (existingStations.has(stationName)) return;
    branch.children = branch.children || [];
    branch.children.push(createSystemNode(stationName, nextBranches, branch.children));
    existingStations.add(stationName);
    addedStations.push(stationName);
  });

  return {
    success: true,
    branches: nextBranches,
    branchName,
    addedStations,
  };
}

function filterBranchesForUser(branches = [], user) {
  if (!user || user.role === 'admin' || !user.branch_name) {
    return clone(branches);
  }
  return clone((branches || []).filter((branch) => branch?.name_branch === user.branch_name));
}

function mergeVisibleBranchesIntoFull(fullBranches = [], visibleBranches = [], user) {
  if (!user || user.role === 'admin') {
    return clone(visibleBranches);
  }

  const nextFull = clone(fullBranches);
  const branchName = user.branch_name;
  const visibleBranch = (visibleBranches || []).find((branch) => branch?.name_branch === branchName);
  if (!visibleBranch) {
    return nextFull;
  }

  const targetIndex = nextFull.findIndex((branch) => branch?.name_branch === branchName);
  if (targetIndex >= 0) {
    nextFull[targetIndex] = clone(visibleBranch);
  } else {
    nextFull.push(clone(visibleBranch));
  }
  return nextFull;
}

module.exports = {
  clone,
  normalizeBranchName,
  ensureBranchStructure,
  filterBranchesForUser,
  mergeVisibleBranchesIntoFull,
};
