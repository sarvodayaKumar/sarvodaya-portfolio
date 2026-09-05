const DEV = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";
const SI = "https://cdn.simpleicons.org";

/** Full image URLs. Prefer Devicon originals (colored) so marks stay visible in dark mode. */
const ICONS: Record<string, string> = {
  golang: `${DEV}/go/go-original.svg`,
  go: `${DEV}/go/go-original.svg`,
  c: `${DEV}/c/c-original.svg`,
  docker: `${DEV}/docker/docker-original.svg`,
  kubernetes: `${DEV}/kubernetes/kubernetes-plain.svg`,
  helm: `${DEV}/helm/helm-original.svg`,
  jenkins: `${DEV}/jenkins/jenkins-original.svg`,
  bash: `${DEV}/bash/bash-original.svg`,
  maven: `${DEV}/maven/maven-original.svg`,
  yaml: `${SI}/yaml/CB171E`,
  git: `${DEV}/git/git-original.svg`,
  azure: `${DEV}/azure/azure-original.svg`,
  "azure devops": `${DEV}/azuredevops/azuredevops-original.svg`,
  "azure apim": `${DEV}/azure/azure-original.svg`,
  terraform: `${DEV}/terraform/terraform-original.svg`,
  hcl: `${DEV}/terraform/terraform-original.svg`,
  ansible: `${DEV}/ansible/ansible-original.svg`,
  prometheus: `${DEV}/prometheus/prometheus-original.svg`,
  grafana: `${DEV}/grafana/grafana-original.svg`,
  trivy: `${SI}/aqua`,
  aqua: `${SI}/aqua`,
  security: `${SI}/aqua`,
  jfrog: `${SI}/jfrog/41BF47`,
  artifactory: `${SI}/jfrog/41BF47`,
  linux: `${DEV}/linux/linux-original.svg`,
  rhel: `${DEV}/redhat/redhat-original.svg`,
  ubuntu: `${DEV}/ubuntu/ubuntu-plain.svg`,
  postgres: `${DEV}/postgresql/postgresql-original.svg`,
  postgresql: `${DEV}/postgresql/postgresql-original.svg`,
  grpc: `${DEV}/grpc/grpc-original.svg`,
  rest: `${SI}/swagger/85EA2D`,
  restful: `${SI}/swagger/85EA2D`,
  api: `${SI}/swagger/85EA2D`,
  github: `${DEV}/github/github-original.svg`,
  "ci/cd": `${SI}/githubactions/2088FF`,
  cicd: `${SI}/githubactions/2088FF`,
  apim: `${DEV}/azure/azure-original.svg`,
  cisco: `${SI}/cisco/1BA0D7`,
  networking: `${SI}/cisco/1BA0D7`,
};

export function skillKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function skillIconUrl(name: string) {
  const key = skillKey(name);
  if (!key) return null;
  if (ICONS[key]) return ICONS[key];

  const needles = Object.keys(ICONS).sort((a, b) => b.length - a.length);
  const tokens = key.split(/[\s/]+/);
  for (const needle of needles) {
    if (needle.length < 2) continue;
    if (key === needle || key.startsWith(`${needle} `) || tokens.includes(needle)) {
      return ICONS[needle];
    }
  }
  return null;
}
