// #region agent log
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const logPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../debug-a47dfb.log');
const sessionId = 'a47dfb';

function log(hypothesisId, location, message, data) {
  const entry = {
    sessionId,
    runId: 'docker-pull-diag',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  fetch('http://127.0.0.1:7439/ingest/314a377e-205f-4ab8-99eb-9acb707d9ed6', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': sessionId,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

function pull(image) {
  const result = spawnSync('docker', ['pull', image], {
    encoding: 'utf8',
    timeout: 120000,
  });
  return {
    image,
    status: result.status,
    stdout: (result.stdout || '').slice(-500),
    stderr: (result.stderr || '').slice(-500),
  };
}

log('C', 'diagnose-docker-pull.mjs:start', 'Starting docker pull diagnostics', {
  composeMinioImage: 'minio/minio:latest',
});

const images = [
  { id: 'A', image: 'minio/minio:latest' },
  { id: 'E', image: 'minio/minio:RELEASE.2024-12-18T13-15-44Z' },
  { id: 'D', image: 'quay.io/minio/minio:latest' },
  { id: 'C', image: 'mongo:7' },
];

for (const item of images) {
  const result = pull(item.image);
  log(item.id, 'diagnose-docker-pull.mjs:pull', 'docker pull result', {
    image: result.image,
    status: result.status,
    stderrTail: result.stderr,
    stdoutTail: result.stdout,
    denied: /access denied|not found|unauthorized|denied/i.test(
      `${result.stderr}\n${result.stdout}`,
    ),
  });
}

log('B', 'diagnose-docker-pull.mjs:auth', 'docker auth/info snapshot', {
  dockerInfo: spawnSync('docker', ['info', '--format', '{{.RegistryConfig.IndexConfigs}}'], {
    encoding: 'utf8',
  }).stdout?.slice(0, 300),
  dockerLoginConfigured: Boolean(
    spawnSync('docker', ['system', 'info'], { encoding: 'utf8' }).stdout,
  ),
});

log('C', 'diagnose-docker-pull.mjs:done', 'Diagnostics complete', {});
// #endregion
