import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/testimoni/[id].astro
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
	let testimonial = isEdit ? await db.testimonial.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !testimonial) return Astro.redirect("/admin/testimoni?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const name = data.get("name")?.toString() || "";
		const role = data.get("role")?.toString() || "Siswa";
		const content = data.get("content")?.toString() || "";
		const photoUrl = data.get("photoUrl")?.toString() || null;
		const verified = data.get("verified") === "1";
		if (isEdit) await db.testimonial.update({
			where: { id },
			data: {
				name,
				role,
				content,
				photoUrl,
				verified
			}
		});
		else await db.testimonial.create({ data: {
			name,
			role,
			content,
			photoUrl,
			verified
		} });
		return Astro.redirect("/admin/testimoni?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Testimoni" : "Tambah Testimoni",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST"><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama *</label><input type="text" name="name"${addAttribute(testimonial?.name || "", "value")} required placeholder="Nama pemberi testimoni..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Role *</label><select name="role">${[
		"Siswa",
		"Orang Tua",
		"Alumni",
		"Mitra"
	].map((r) => renderTemplate`<option${addAttribute(r, "value")}${addAttribute((testimonial?.role || "Siswa") === r, "selected")}>${r}</option>`)}</select></div></div></div><div class="card" style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Konten Testimoni *</label><textarea name="content" rows="6" style="resize:vertical" required placeholder="Tulis testimoni di sini...">${testimonial?.content || ""}</textarea></div><div class="card" style="margin-bottom:16px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Foto</label><input type="text" name="photoUrl"${addAttribute(testimonial?.photoUrl || "", "value")} placeholder="https://... atau /uploads/..."></div><div style="padding-bottom:4px"><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" name="verified" value="1"${addAttribute(testimonial?.verified ?? false, "checked")} style="width:auto"> Terverifikasi</label></div></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/testimoni" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/testimoni/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/testimoni/[id].astro";
var $$url = "/admin/testimoni/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/testimoni/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
