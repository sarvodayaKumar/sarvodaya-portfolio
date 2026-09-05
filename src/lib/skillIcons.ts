const SLUGS: Record<string, string> = {
  golang: "go",
  go: "go",
  c: "c",
  docker: "docker",
  kubernetes: "kubernetes",
  helm: "helm",
  jenkins: "jenkins",
  bash: "gnubash",
  maven: "apachemaven",
  yaml: "yaml",
  git: "git",
  azure: "microsoftazure",
  "azure devops": "azuredevops",
  "azure apim": "microsoftazure",
  terraform: "terraform",
  hcl: "hashicorp",
  ansible: "ansible",
  prometheus: "prometheus",
  grafana: "grafana",
  trivy: "aquasecurity",
  security: "aquasecurity",
  jfrog: "jfrog",
  artifactory: "jfrog",
  linux: "linux",
  rhel: "redhat",
  ubuntu: "ubuntu",
  postgres: "postgresql",
  postgresql: "postgresql",
  grpc: "grpc",
  rest: "swagger",
  restful: "swagger",
  api: "swagger",
  github: "github",
  "ci/cd": "githubactions",
  cicd: "githubactions",
  apim: "microsoftazure",
  tenable: "tenable",
};

export function skillKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function skillSlug(name: string) {
  const key = skillKey(name);
  if (!key) return null;
  if (SLUGS[key]) return SLUGS[key];

  const needles = Object.keys(SLUGS).sort((a, b) => b.length - a.length);
  const tokens = key.split(/[\s/]+/);
  for (const needle of needles) {
    if (key === needle || key.startsWith(`${needle} `) || tokens.includes(needle)) {
      return SLUGS[needle];
    }
  }
  return null;
}

export function skillIconUrl(name: string) {
  const slug = skillSlug(name);
  return slug ? `https://cdn.simpleicons.org/${slug}` : null;
}
