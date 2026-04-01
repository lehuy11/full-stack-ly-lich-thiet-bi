const {
  normalizeLookup,
  normalizeEnterpriseName,
  normalizeBranchName,
  inferEnterpriseFromBranch,
  getEnterpriseOptions,
  getBranchOptionsByEnterprise,
  getStationsForEnterpriseBranch,
} = require('./organization');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
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

function isEnterpriseNode(item) {
  return Boolean(item && typeof item === 'object' && item.name_enterprise && Array.isArray(item.children));
}

function isBranchNode(item) {
  return Boolean(item && typeof item === 'object' && item.name_branch && Array.isArray(item.children));
}

function isSystemNode(item) {
  return Boolean(item && typeof item === 'object' && item.name_system && Array.isArray(item.children));
}

function getSystemChildrenTemplate(tree = []) {
  const stack = Array.isArray(tree) ? [...tree] : [];

  while (stack.length > 0) {
    const current = stack.shift();
    if (isEnterpriseNode(current) || isBranchNode(current)) {
      stack.push(...(current.children || []));
      continue;
    }
    if (isSystemNode(current) && Array.isArray(current.children) && current.children.length > 0) {
      return clone(current.children);
    }
  }

  return [];
}

function createSystemNode(stationName, templateChildren, existingSystems = []) {
  return {
    id: makeNumericId(existingSystems),
    name_system: `Hệ thống TTTH ga ${normalizeStationName(stationName)}`,
    children: clone(templateChildren || []),
  };
}

function createDefaultOrganizationsTree(templateChildren = []) {
  return getEnterpriseOptions().map((enterpriseName, enterpriseIndex) => ({
    id: String(enterpriseIndex + 1),
    name_enterprise: enterpriseName,
    children: getBranchOptionsByEnterprise(enterpriseName).map((branchName, branchIndex) => ({
      id: String(branchIndex + 1),
      name_branch: branchName,
      children: getStationsForEnterpriseBranch(enterpriseName, branchName).map((stationName, stationIndex, stations) => ({
        ...createSystemNode(stationName, templateChildren, stations.slice(0, stationIndex)),
        id: String(stationIndex + 1),
      })),
    })),
  }));
}

function normalizeSystemNode(system = {}) {
  return {
    id: String(system.id || ''),
    name_system: `Hệ thống TTTH ga ${normalizeStationName(system.name_system || system.name || '')}`,
    children: Array.isArray(system.children) ? clone(system.children) : [],
  };
}

function normalizeBranchNode(branch = {}) {
  return {
    id: String(branch.id || ''),
    name_branch: normalizeBranchName(branch.name_branch || branch.name || ''),
    children: Array.isArray(branch.children) ? branch.children.filter(isSystemNode).map(normalizeSystemNode) : [],
  };
}

function normalizeEnterpriseNode(enterprise = {}) {
  return {
    id: String(enterprise.id || ''),
    name_enterprise: normalizeEnterpriseName(enterprise.name_enterprise || enterprise.name || ''),
    children: Array.isArray(enterprise.children) ? enterprise.children.filter(isBranchNode).map(normalizeBranchNode) : [],
  };
}

function mergeOrganizations(baseOrganizations = [], incomingOrganizations = []) {
  const next = clone(baseOrganizations);

  (incomingOrganizations || []).forEach((enterprise) => {
    const enterpriseName = normalizeEnterpriseName(enterprise?.name_enterprise || enterprise?.name || '');
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
      const branchName = normalizeBranchName(branch?.name_branch || branch?.name || '');
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
        const stationName = normalizeStationName(system?.name_system || system?.name || '');
        if (!stationName) return;
        const normalizedSystem = normalizeSystemNode(system);
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

function normalizeOrganizationsTree(rawTree = []) {
  const safeRawTree = Array.isArray(rawTree) ? rawTree : [];
  const templateChildren = getSystemChildrenTemplate(safeRawTree);
  const defaultTree = createDefaultOrganizationsTree(templateChildren);

  if (safeRawTree.every(isEnterpriseNode)) {
    return mergeOrganizations(defaultTree, safeRawTree.map(normalizeEnterpriseNode));
  }

  if (safeRawTree.every(isBranchNode)) {
    const migratedTree = safeRawTree.reduce((accumulator, branch) => {
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

    return mergeOrganizations(defaultTree, migratedTree);
  }

  return defaultTree;
}

function ensureOrganizationBranchStructure(organizations = [], rawEnterpriseName = '', rawBranchName = '', rawStations = []) {
  const enterpriseName = normalizeEnterpriseName(rawEnterpriseName) || inferEnterpriseFromBranch(rawBranchName);
  const branchName = normalizeBranchName(rawBranchName);
  const nextOrganizations = normalizeOrganizationsTree(organizations);
  const templateChildren = getSystemChildrenTemplate(nextOrganizations);

  if (!enterpriseName) {
    return {
      success: false,
      message: 'Phải chọn xí nghiệp cho tài khoản cung trưởng.',
      organizations: nextOrganizations,
      addedStations: [],
    };
  }

  if (!branchName) {
    return {
      success: false,
      message: 'Phải chọn cung phụ trách cho tài khoản cung trưởng.',
      organizations: nextOrganizations,
      addedStations: [],
    };
  }

  const stationNames = Array.from(new Set([
    ...getStationsForEnterpriseBranch(enterpriseName, branchName),
    ...parseStationNames(rawStations),
  ])).filter(Boolean);

  if (stationNames.length === 0) {
    return {
      success: false,
      message: 'Cung này chưa có danh sách ga.',
      organizations: nextOrganizations,
      addedStations: [],
    };
  }

  let enterpriseIndex = nextOrganizations.findIndex(
    (enterprise) => normalizeLookup(enterprise?.name_enterprise) === normalizeLookup(enterpriseName),
  );
  if (enterpriseIndex < 0) {
    nextOrganizations.push({ id: makeNumericId(nextOrganizations), name_enterprise: enterpriseName, children: [] });
    enterpriseIndex = nextOrganizations.length - 1;
  }

  const enterprise = nextOrganizations[enterpriseIndex];
  enterprise.children = Array.isArray(enterprise.children) ? enterprise.children : [];

  let branchIndex = enterprise.children.findIndex(
    (branch) => normalizeLookup(branch?.name_branch) === normalizeLookup(branchName),
  );
  if (branchIndex < 0) {
    enterprise.children.push({ id: makeNumericId(enterprise.children), name_branch: branchName, children: [] });
    branchIndex = enterprise.children.length - 1;
  }

  const branch = enterprise.children[branchIndex];
  branch.children = Array.isArray(branch.children) ? branch.children : [];
  const existingStations = new Set(
    branch.children.map((system) => normalizeLookup(normalizeStationName(system?.name_system || ''))).filter(Boolean),
  );

  const addedStations = [];
  stationNames.forEach((stationName) => {
    if (existingStations.has(normalizeLookup(stationName))) return;
    branch.children.push(createSystemNode(stationName, templateChildren, branch.children));
    existingStations.add(normalizeLookup(stationName));
    addedStations.push(normalizeStationName(stationName));
  });

  return {
    success: true,
    organizations: nextOrganizations,
    enterpriseName,
    branchName,
    addedStations,
  };
}

function filterOrganizationsForUser(organizations = [], user) {
  const normalized = normalizeOrganizationsTree(organizations);
  if (!user || user.role === 'admin') {
    return normalized;
  }

  const enterpriseName = normalizeEnterpriseName(user.enterprise_name || inferEnterpriseFromBranch(user.branch_name || ''));
  const branchName = normalizeBranchName(user.branch_name || '');

  return normalized
    .filter((enterprise) => !enterpriseName || normalizeLookup(enterprise?.name_enterprise) === normalizeLookup(enterpriseName))
    .map((enterprise) => ({
      ...enterprise,
      children: (enterprise.children || []).filter(
        (branch) => !branchName || normalizeLookup(branch?.name_branch) === normalizeLookup(branchName),
      ),
    }))
    .filter((enterprise) => (enterprise.children || []).length > 0);
}

function mergeVisibleOrganizationsIntoFull(fullOrganizations = [], visibleOrganizations = [], user) {
  const normalizedFull = normalizeOrganizationsTree(fullOrganizations);
  const normalizedVisible = normalizeOrganizationsTree(visibleOrganizations);

  if (!user || user.role === 'admin') {
    return normalizedVisible;
  }

  const enterpriseName = normalizeEnterpriseName(user.enterprise_name || inferEnterpriseFromBranch(user.branch_name || ''));
  const branchName = normalizeBranchName(user.branch_name || '');
  const visibleEnterprise = normalizedVisible.find(
    (enterprise) => normalizeLookup(enterprise?.name_enterprise) === normalizeLookup(enterpriseName),
  );
  if (!visibleEnterprise) return normalizedFull;

  const visibleBranch = (visibleEnterprise.children || []).find(
    (branch) => normalizeLookup(branch?.name_branch) === normalizeLookup(branchName),
  );
  if (!visibleBranch) return normalizedFull;

  const nextFull = clone(normalizedFull);
  let enterpriseIndex = nextFull.findIndex(
    (enterprise) => normalizeLookup(enterprise?.name_enterprise) === normalizeLookup(enterpriseName),
  );
  if (enterpriseIndex < 0) {
    nextFull.push({ id: makeNumericId(nextFull), name_enterprise: enterpriseName, children: [] });
    enterpriseIndex = nextFull.length - 1;
  }

  const targetEnterprise = nextFull[enterpriseIndex];
  targetEnterprise.children = Array.isArray(targetEnterprise.children) ? targetEnterprise.children : [];

  const branchIndex = targetEnterprise.children.findIndex(
    (branch) => normalizeLookup(branch?.name_branch) === normalizeLookup(branchName),
  );
  if (branchIndex >= 0) {
    targetEnterprise.children[branchIndex] = clone(visibleBranch);
  } else {
    targetEnterprise.children.push(clone(visibleBranch));
  }

  return nextFull;
}

module.exports = {
  clone,
  normalizeEnterpriseName,
  normalizeBranchName,
  normalizeOrganizationsTree,
  ensureOrganizationBranchStructure,
  filterOrganizationsForUser,
  mergeVisibleOrganizationsIntoFull,
};
