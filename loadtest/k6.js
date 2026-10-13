// Usage: k6 run -e API=http://localhost:4000 -e KEY=wf_xxx -e WF=<workflowId> loadtest/k6.js
import http from "k6/http";
import { check } from "k6";
export const options = {
  scenarios: {
    burst: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 1200,
      stages: [
        { target: 500, duration: "30s" },
        { target: 1000, duration: "60s" },
        { target: 0, duration: "15s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};
export default function () {
  const r = http.post(
    `${__ENV.API}/api/workflows/${__ENV.WF}/run`,
    JSON.stringify({ input: { n: 7 } }),
    { headers: { "content-type": "application/json", "x-api-key": __ENV.KEY } },
  );
  check(r, { accepted: (x) => x.status === 202 });
}
