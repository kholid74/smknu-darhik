import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/pengumuman/[id].astro
var _id__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Id,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Id = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Id;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return Astro.redirect("/admin/login");
	const session = await verifyToken(token);
	if (!session) return Astro.redirect("/admin/login");
	const { id } = Astro.params;
	const isEdit = id && id !== "new";
	const item = isEdit ? await db.announcement.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/pengumuman?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			title: data.get("title")?.toString() || "",
			body: data.get("body")?.toString() || null,
			linkUrl: data.get("linkUrl")?.toString() || null,
			linkLabel: data.get("linkLabel")?.toString() || null,
			active: data.get("active") === "1"
		};
		const expiresAtRaw = data.get("expiresAt")?.toString();
		if (expiresAtRaw) record.expiresAt = new Date(expiresAtRaw);
		else record.expiresAt = null;
		if (isEdit) await db.announcement.update({
			where: { id },
			data: record
		});
		else await db.announcement.create({ data: record });
		return Astro.redirect("/admin/pengumuman?saved=1");
	}
	function toDatetimeLocal(d) {
		if (!d) return "";
		const pad = (n) => n.toString().padStart(2, "0");
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Pengumuman" : "Tambah Pengumuman",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul *</label><input type="text" name="title"${addAttribute(item?.title || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Isi</label><textarea name="body" rows="8" style="resize:vertical">${item?.body || ""}</textarea></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Link</label><input type="url" name="linkUrl"${addAttribute(item?.linkUrl || "", "value")} placeholder="https://..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Label Link</label><input type="text" name="linkLabel"${addAttribute(item?.linkLabel || "", "value")} placeholder="Selengkapnya"></div></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kadaluarsa</label><input type="datetime-local" name="expiresAt"${addAttribute(toDatetimeLocal(item?.expiresAt), "value")}></div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600"><input type="checkbox" name="active" value="1"${addAttribute(item?.active ?? true, "checked")} style="width:auto"> Aktif</label></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/pengumuman" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengumuman/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengumuman/[id].astro";
var $$url = "/admin/pengumuman/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/pengumuman/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
