import fs from "fs";
import path from "path";

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const owner = "ProjectXDz";
const repo = "api-lang";
const base = process.cwd();

const IGNORE = new Set([
  ".git", "node_modules", ".local", "dist", "scripts/github-push.mjs"
]);

function getAllFiles(dir, root = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full, root));
    } else {
      results.push(path.relative(root, full));
    }
  }
  return results;
}

async function api(method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "replit-agent",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API ${method} ${endpoint} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log("Collecting files...");
  const files = getAllFiles(base);
  console.log(`Found ${files.length} files`);

  // Get or create base commit
  let baseSha = null;
  let baseTreeSha = null;
  try {
    const ref = await api("GET", `/repos/${owner}/${repo}/git/refs/heads/main`);
    baseSha = ref.object.sha;
    const commit = await api("GET", `/repos/${owner}/${repo}/git/commits/${baseSha}`);
    baseTreeSha = commit.tree.sha;
    console.log("Base commit:", baseSha);
  } catch {
    console.log("No existing main branch — will create initial commit");
  }

  // Create blobs for all files
  console.log("Creating blobs...");
  const treeItems = [];
  for (const filePath of files) {
    const fullPath = path.join(base, filePath);
    const content = fs.readFileSync(fullPath);
    const isBinary = content.includes(0);
    const blob = await api("POST", `/repos/${owner}/${repo}/git/blobs`, {
      content: isBinary ? content.toString("base64") : content.toString("utf-8"),
      encoding: isBinary ? "base64" : "utf-8",
    });
    treeItems.push({ path: filePath, mode: "100644", type: "blob", sha: blob.sha });
    process.stdout.write(".");
  }
  console.log("\nAll blobs created.");

  // Create tree
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const tree = await api("POST", `/repos/${owner}/${repo}/git/trees`, treePayload);
  console.log("Tree created:", tree.sha);

  // Create commit
  const commitPayload = {
    message: "chore: push full codebase from Replit",
    tree: tree.sha,
  };
  if (baseSha) commitPayload.parents = [baseSha];
  const commit = await api("POST", `/repos/${owner}/${repo}/git/commits`, commitPayload);
  console.log("Commit created:", commit.sha);

  // Update or create ref
  if (baseSha) {
    await api("PATCH", `/repos/${owner}/${repo}/git/refs/heads/main`, {
      sha: commit.sha,
      force: true,
    });
  } else {
    await api("POST", `/repos/${owner}/${repo}/git/refs`, {
      ref: "refs/heads/main",
      sha: commit.sha,
    });
  }

  console.log(`\nDone! View at https://github.com/${owner}/${repo}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
