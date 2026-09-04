export const site = {
  role: "Cloud Backend Developer",
  location: "Bangalore, India",
  headline: "I design and ship production backends on Azure — Go services, Kubernetes, and Terraform.",
  pitch:
    "Senior engineer with 5+ years building cloud-native platforms: APIs and microservices in Go, infrastructure as code, CI/CD, and the observability that keeps those systems honest.",
  about: [
    "I work at the intersection of backend engineering and cloud infrastructure. Most of my time is spent in Go — REST and gRPC services, Terraform providers, and the glue that turns a Kubernetes cluster into something a product team can actually ship on.",
    "At Wipro I spent four years architecting cloud-native microservices on Azure: container orchestration, encrypted service-to-service communication, and Azure DevOps pipelines that cut release cycle time. At Calsoft I now extend Aqua Security’s Terraform provider — resources, REST clients, API-key auth, acceptance tests, and drift detection against real platform state.",
    "Upstream I contribute to Sensu’s observability engine (handlers, pipelines, etcd, packaging) and to terraform-provider-aquasec. I care about schema that matches the API, tests that exercise plan/apply/destroy, and infrastructure that is reproducible.",
  ],
  now: [
    { k: "Role", v: "Senior Development Engineer, Calsoft" },
    { k: "Focus", v: "Terraform providers, Go API clients, and IaC for cloud security platforms" },
    { k: "Cloud", v: "Azure · Kubernetes · Docker · Helm" },
    { k: "Upstream", v: "Aqua Security Terraform provider and Sensu Go" },
  ],
  services: [
    {
      title: "Go backends",
      body: "Production microservices, REST and gRPC APIs, Postgres, and the layering that keeps a service maintainable after the third on-call rotation.",
    },
    {
      title: "Cloud on Azure",
      body: "Provisioning, networking fundamentals, container workloads, and Azure DevOps delivery for services that have to stay up.",
    },
    {
      title: "Kubernetes & delivery",
      body: "Docker, Helm, Jenkins, and CI/CD that move a change from commit to cluster with scanning and promotion gates.",
    },
    {
      title: "IaC & providers",
      body: "Terraform modules and custom Go providers: schema, REST clients, acceptance tests, and drift between desired and actual state.",
    },
  ],
  principles: [
    {
      title: "Desired state is a contract",
      body: "Terraform schema, REST APIs, and cluster config should describe the same world. Drift is a bug, not a surprise.",
    },
    {
      title: "Test the lifecycle",
      body: "Create, read, update, destroy — and the CI that refuses a merge when any of those steps lie.",
    },
    {
      title: "Observe what you ship",
      body: "Prometheus, Grafana, and the Sensu-style pipelines that turn events into something an engineer can act on.",
    },
  ],
  contact:
    "Based in Bangalore. I am open to conversations about Go backends, Azure platforms, Kubernetes delivery, and Terraform providers.",
};
