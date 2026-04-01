const ORGANIZATION_STRUCTURE = [
  {
    name: 'Sài Gòn',
    branches: [
      { name: 'Cung Gia Ray', stations: ['Gia Huynh', 'Trản Táo', 'Gia Ray'] },
      { name: 'Cung Long Khánh', stations: ['Bảo Chánh', 'Long Khánh', 'Dầu Giây'] },
      { name: 'Cung Trảng Bom', stations: ['Hố Nai', 'Trảng Bom', 'Trung Hòa'] },
      { name: 'Cung Sóng Thần', stations: ['Sóng Thần', 'Dĩ An', 'Biên Hòa'] },
      { name: 'Cung Sài Gòn', stations: ['Sài Gòn', 'Gò Vấp', 'Bình Triệu'] },
    ],
  },
  {
    name: 'Thuận Hải',
    branches: [
      { name: 'Cung Tháp Chàm', stations: ['Kà Rôm', 'Phước Nhơn', 'Tháp Chàm'] },
      { name: 'Cung Cà Ná', stations: ['Hòa Trinh', 'Cà Ná', 'Vĩnh Tân'] },
      { name: 'Cung Vĩnh Hảo', stations: ['Vĩnh Hảo', 'Sông Lòng Sông', 'Phong Phú'] },
      { name: 'Cung Sông Mao', stations: ['Sông Mao', 'Châu Hanh', 'Sông Lũy'] },
      { name: 'Cung Ma Lâm', stations: ['Long Thạnh', 'Ma Lâm', 'Hàm Liêm'] },
      { name: 'Cung Bình Thuận', stations: ['Bình Thuận', 'Hàm Cường Tây', 'Suối Vận'] },
      { name: 'Cung Sông Dinh', stations: ['Sông Phan', 'Sông Dinh', 'Suối Kiết'] },
    ],
  },
  {
    name: 'Phú Khánh',
    branches: [
      { name: 'Cung Vân Canh', stations: ['Tân Vinh', 'Vân Canh', 'Phước Lãnh'] },
      { name: 'Cung Chí Thạnh', stations: ['La Hai', 'Xuân Sơn Nam', 'Chí Thạnh'] },
      { name: 'Cung Tuy Hòa', stations: ['Hòa Đa', 'Tuy Hòa', 'Đông Tác'] },
      { name: 'Cung Đại Lãnh', stations: ['Phú Hiệp', 'Hảo Sơn', 'Đại Lãnh'] },
      { name: 'Cung Giã', stations: ['Tu Bông', 'Giã', 'Hòa Huỳnh'] },
      { name: 'Cung Ninh Hòa', stations: ['Ninh Hòa', 'Phong Thạnh', 'Lương Sơn'] },
      { name: 'Cung Nha Trang', stations: ['Nha Trang', 'Cây Cầy', 'Hòa Tân'] },
      { name: 'Cung Ngã Ba', stations: ['Suối Cát', 'Ngã Ba', 'Cam Thịnh Đông'] },
    ],
  },
];

function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeLookup(value = '') {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const ENTERPRISE_LOOKUP = new Map();
const BRANCH_LOOKUP = new Map();
const BRANCH_TO_ENTERPRISE = new Map();
const STATIONS_BY_ENTERPRISE_BRANCH = new Map();

ORGANIZATION_STRUCTURE.forEach((enterprise) => {
  ENTERPRISE_LOOKUP.set(normalizeLookup(enterprise.name), enterprise.name);
  enterprise.branches.forEach((branch) => {
    BRANCH_LOOKUP.set(normalizeLookup(branch.name), branch.name);
    BRANCH_TO_ENTERPRISE.set(normalizeLookup(branch.name), enterprise.name);
    STATIONS_BY_ENTERPRISE_BRANCH.set(
      `${normalizeLookup(enterprise.name)}__${normalizeLookup(branch.name)}`,
      [...branch.stations],
    );
  });
});

function normalizeEnterpriseName(value = '') {
  const cleaned = normalizeText(value);
  if (!cleaned) return '';
  return ENTERPRISE_LOOKUP.get(normalizeLookup(cleaned)) || cleaned;
}

function normalizeBranchName(value = '') {
  const cleaned = normalizeText(value);
  if (!cleaned) return '';
  if (BRANCH_LOOKUP.has(normalizeLookup(cleaned))) {
    return BRANCH_LOOKUP.get(normalizeLookup(cleaned));
  }
  if (/^cung\s+/i.test(cleaned)) {
    return cleaned.replace(/^cung\s+/i, 'Cung ');
  }
  return `Cung ${cleaned}`;
}

function inferEnterpriseFromBranch(branchName = '') {
  const normalizedBranch = normalizeBranchName(branchName);
  return BRANCH_TO_ENTERPRISE.get(normalizeLookup(normalizedBranch)) || '';
}

function getEnterpriseOptions() {
  return ORGANIZATION_STRUCTURE.map((item) => item.name);
}

function getBranchOptionsByEnterprise(enterpriseName = '') {
  const normalizedEnterprise = normalizeEnterpriseName(enterpriseName);
  const enterprise = ORGANIZATION_STRUCTURE.find((item) => item.name === normalizedEnterprise);
  return enterprise ? enterprise.branches.map((branch) => branch.name) : [];
}

function getStationsForEnterpriseBranch(enterpriseName = '', branchName = '') {
  const enterprise = normalizeEnterpriseName(enterpriseName);
  const branch = normalizeBranchName(branchName);
  return [
    ...(STATIONS_BY_ENTERPRISE_BRANCH.get(`${normalizeLookup(enterprise)}__${normalizeLookup(branch)}`) || []),
  ];
}

module.exports = {
  ORGANIZATION_STRUCTURE,
  normalizeLookup,
  normalizeEnterpriseName,
  normalizeBranchName,
  inferEnterpriseFromBranch,
  getEnterpriseOptions,
  getBranchOptionsByEnterprise,
  getStationsForEnterpriseBranch,
};
