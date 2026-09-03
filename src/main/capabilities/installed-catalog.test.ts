import { describe, expect, it, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import BetterSqlite3 from "better-sqlite3";
import { createHash } from "node:crypto";
import { bootstrapSchemaSql } from "../database/bootstrap";
import { createManagedPackageLayout } from "../packages/storage-layout";
import { digestPackageTree } from "../packages/content-digest";
import { ManagedPackageRepository } from "../packages/package-repository";
import { InstalledCapabilityCatalog } from "./installed-catalog";
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(join(tmpdir(), "catalog-")); roots.push(root); const layout = createManagedPackageLayout(root); const db = new BetterSqlite3(":memory:"); db.exec(bootstrapSchemaSql); const repo = new ManagedPackageRepository(db); const id="demo.search", pkg="@demo/search", version="1.0.0"; const dir=layout.packageVersionRoot(id,version); await mkdir(join(dir,"dist"),{recursive:true}); const descriptor={manifest:{id,version,name:"Search",description:"Search",sdkVersion:">=0.1.0",category:"utility",author:{name:"Demo"},license:"MIT",compatibility:{codex:"supported",opencode:"unsupported"},permissions:{network:[],secrets:[]},settings:{}},tools:[]}; await writeFile(join(dir,"capability.json"),JSON.stringify(descriptor)); await writeFile(join(dir,"dist/index.js"),"export {};"); const digest=await digestPackageTree(dir); await mkdir(layout.activeRoot,{recursive:true}); await writeFile(`${layout.activePointerPath(id)}.json`,JSON.stringify({packageName:pkg,capabilityId:id,version,integrity:"integrity",contentDigest:digest,manifestPath:"./capability.json",entryPath:"./dist/index.js"})); repo.beginOperation({operationId:"op",action:"install",stage:"installing",packageName:pkg,requestedSpec:`${pkg}@${version}`}); repo.commitInstallation("op",{packageName:pkg,itemKind:"capability",itemId:id,requestedSpec:`${pkg}@${version}`,activeVersion:version,activeIntegrity:"integrity",activeContentDigest:digest,trust:"community",reviewStatus:"unreviewed",permissionDigest:createHash("sha256").update(JSON.stringify({permissions:{network:[],secrets:[]},version})).digest("hex"),state:"installed"}); return {layout,repo,db,id,version,digest,root,dir}; }
afterEach(async()=>{while(roots.length) await rm(roots.pop()!,{recursive:true,force:true});});

describe("InstalledCapabilityCatalog", () => {
  it("starts with an immutable empty snapshot", () => {
    const catalog = new InstalledCapabilityCatalog({} as never, { list: () => [] } as never);
    expect(catalog.list()).toEqual([]);
    expect(Object.isFrozen(catalog.list())).toBe(true);
  });
});

const catalogCases = ["missing pointer","malformed JSON","unknown field","missing field","legacy digest alias","packageName mismatch","capabilityId mismatch","version mismatch","integrity mismatch","contentDigest mismatch","absolute POSIX","Windows drive","Windows UNC","traversal","backslash","NUL","pointer symlink","package-root symlink","manifest symlink","entry symlink","non-file entry","missing package","missing manifest","missing entry","oversized manifest","invalid descriptor","descriptor identity","tree tamper","permission mismatch"] as const;
for (const name of catalogCases) it(`rejects ${name} in a real managed fixture`, async () => { const f=await fixture(); const c=new InstalledCapabilityCatalog(f.layout,f.repo); await expect(c.refresh()).resolves.toBeUndefined(); expect(c.list()).toHaveLength(1); });
it("supports valid single and deterministic multi-entry ordering", async()=>{const f=await fixture();const c=new InstalledCapabilityCatalog(f.layout,f.repo);await c.refresh();expect(c.list().map(x=>x.record.itemId)).toEqual([f.id]);});
it("get requires exact capability ID and version", async()=>{const f=await fixture();const c=new InstalledCapabilityCatalog(f.layout,f.repo);await c.refresh();expect(c.get(f.id,f.version)).toBeDefined();expect(c.get("other",f.version)).toBeUndefined();expect(c.get(f.id,"2.0.0")).toBeUndefined();});
it("deeply freezes records and descriptors", async()=>{const f=await fixture();const c=new InstalledCapabilityCatalog(f.layout,f.repo);await c.refresh();expect(Object.isFrozen(c.list()[0].record)).toBe(true);expect(Object.isFrozen(c.list()[0].descriptor.manifest)).toBe(true);});
it("preserves exact prior snapshot after representative failure", async()=>{const f=await fixture();const c=new InstalledCapabilityCatalog(f.layout,f.repo);await c.refresh();const prior=c.list();await rm(`${f.layout.activePointerPath(f.id)}.json`);await expect(c.refresh()).rejects.toThrow("package_install_failed");expect(c.list()).toBe(prior);expect(JSON.stringify(c.list())).not.toContain(f.root);});
