import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { r as renderScript } from "./site_BD_vKQs6.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/components/TiptapEditor.astro
createAstro("https://astro.build");
var $$TiptapEditor = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$TiptapEditor;
	const { content = "" } = Astro.props;
	return renderTemplate`${maybeRenderHead($$result)}<div id="tiptap-editor"${addAttribute(content, "data-content")} data-astro-cid-qsojyyok><div class="tip-tb" data-astro-cid-qsojyyok><button type="button" data-action="bold" title="Bold" data-astro-cid-qsojyyok><strong data-astro-cid-qsojyyok>B</strong></button><button type="button" data-action="italic" title="Italic" data-astro-cid-qsojyyok><em data-astro-cid-qsojyyok>I</em></button><button type="button" data-action="underline" title="Underline" data-astro-cid-qsojyyok><u data-astro-cid-qsojyyok>U</u></button><button type="button" data-action="strike" title="Strikethrough" data-astro-cid-qsojyyok><s data-astro-cid-qsojyyok>S</s></button><span class="tip-sep" data-astro-cid-qsojyyok></span><button type="button" data-action="heading" data-level="2" title="Heading" data-astro-cid-qsojyyok>H2</button><button type="button" data-action="heading" data-level="3" title="Subheading" data-astro-cid-qsojyyok>H3</button><span class="tip-sep" data-astro-cid-qsojyyok></span><button type="button" data-action="bulletList" title="Bullet List" data-astro-cid-qsojyyok>•&nbsp;List</button><button type="button" data-action="orderedList" title="Numbered List" data-astro-cid-qsojyyok>1.&nbsp;List</button><button type="button" data-action="blockquote" title="Quote" data-astro-cid-qsojyyok>❝</button><span class="tip-sep" data-astro-cid-qsojyyok></span><button type="button" data-action="link" title="Link" data-astro-cid-qsojyyok>🔗</button><button type="button" data-action="image" title="Image" data-astro-cid-qsojyyok>🖼</button></div><div class="tip-content" data-astro-cid-qsojyyok></div></div>${renderScript($$result, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/TiptapEditor.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/TiptapEditor.astro", void 0);
//#endregion
//#region src/components/UploadWidget.astro
var $$UploadWidget = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${maybeRenderHead($$result)}<!-- UploadWidget: drag & drop + copy URL --><div class="upload-widget" id="upload-widget" data-astro-cid-uzngm7pm><div class="upload-dropzone" id="upload-dropzone" data-astro-cid-uzngm7pm><span class="material-symbols-outlined" style="font-size:32px;color:#9ca3af;margin-bottom:8px" data-astro-cid-uzngm7pm>cloud_upload</span><p style="font-size:13px;color:#6f7a6e;margin:0" data-astro-cid-uzngm7pm>Drag & drop gambar di sini, atau</p><label style="font-size:13px;color:#1B7A3D;font-weight:700;cursor:pointer;margin-top:4px;display:inline-block" data-astro-cid-uzngm7pm>pilih file<input type="file" accept="image/*" style="display:none" id="upload-input" data-astro-cid-uzngm7pm></label><p style="font-size:11px;color:#9ca3af;margin:4px 0 0" data-astro-cid-uzngm7pm>Max 10MB · JPG, PNG, WebP</p></div><div id="upload-progress" style="display:none;padding:12px;text-align:center;font-size:13px;color:#6f7a6e" data-astro-cid-uzngm7pm><span style="display:inline-block;width:20px;height:20px;border:2px solid #1B7A3D;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:8px" data-astro-cid-uzngm7pm></span> Mengupload...</div><div id="upload-result" style="display:none" data-astro-cid-uzngm7pm></div></div>${renderScript($$result, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/UploadWidget.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/UploadWidget.astro", void 0);
//#endregion
//#region src/pages/admin/artikel/[id].astro
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
	let article = isEdit ? await db.article.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !article) return Astro.redirect("/admin/artikel");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const title = data.get("title")?.toString() || "";
		const slug = data.get("slug")?.toString() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
		const body = data.get("body")?.toString() || "";
		const excerpt = data.get("excerpt")?.toString() || body.replace(/<[^>]*>/g, "").substring(0, 160);
		const category = data.get("category")?.toString() || "Akademik";
		const published = data.get("published") === "1";
		const featured = data.get("featured") === "1";
		const imageUrl = data.get("imageUrl")?.toString() || null;
		if (isEdit) await db.article.update({
			where: { id },
			data: {
				title,
				slug,
				body,
				excerpt,
				category,
				published,
				featured,
				imageUrl
			}
		});
		else await db.article.create({ data: {
			title,
			slug,
			body,
			excerpt,
			category,
			published,
			featured,
			imageUrl
		} });
		return Astro.redirect("/admin/artikel?saved=1");
	}
	const initialBody = article?.body || "";
	const initialTitle = article?.title || "";
	const initialExcerpt = article?.excerpt || "";
	const initialSlug = article?.slug || "";
	const initialCategory = article?.category || "Akademik";
	const initialPublished = article?.published ?? false;
	const initialFeatured = article?.featured ?? false;
	const initialImageUrl = article?.imageUrl || "";
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Artikel" : "Tulis Artikel",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" id="article-form"><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul</label><input type="text" name="title" id="title"${addAttribute(initialTitle, "value")} required placeholder="Judul artikel..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Slug</label><input type="text" name="slug" id="slug-input"${addAttribute(initialSlug, "value")} placeholder="auto-dari-judul"></div></div><div style="margin-top:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kutipan (excerpt)</label><textarea name="excerpt" rows="2" style="resize:vertical" placeholder="Ringkasan singkat...">${initialExcerpt}</textarea></div></div><div class="card" style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:8px">Isi Artikel</label><input type="hidden" name="body"${addAttribute(initialBody, "value")}>${renderComponent($$result, "TiptapEditor", $$TiptapEditor, {
		"content": initialBody,
		"client:load": true,
		"client:component-hydration": "load",
		"client:component-path": "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/TiptapEditor.astro",
		"client:component-export": "default"
	})}</div><div class="card" style="margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kategori</label><select name="category">${[
		"Akademik",
		"Keagamaan",
		"Prestasi",
		"Ekstrakurikuler",
		"PPDB"
	].map((c) => renderTemplate`<option${addAttribute(c, "value")}${addAttribute(initialCategory === c, "selected")}>${c}</option>`)}</select></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Gambar Sampul</label>${initialImageUrl && renderTemplate`<div style="margin-bottom:8px;display:flex;align-items:center;gap:10px;background:#f0f7f1;border-radius:8px;padding:8px 12px"><img${addAttribute(initialImageUrl, "src")} style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="Preview"><div style="flex:1;min-width:0"><p style="font-size:12px;font-weight:600;color:#1c1b1b;margin:0">Gambar tersimpan</p><p style="font-size:11px;color:#6f7a6e;margin:0;word-break:break-all">${initialImageUrl}</p></div></div>`}<input type="text" name="imageUrl"${addAttribute(initialImageUrl, "value")} placeholder="https://... atau upload baru"><details style="margin-top:8px"><summary style="font-size:12px;color:#1B7A3D;cursor:pointer;font-weight:600">Upload gambar baru</summary><div style="margin-top:8px">${renderComponent($$result, "UploadWidget", $$UploadWidget, {
		"client:load": true,
		"client:component-hydration": "load",
		"client:component-path": "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/components/UploadWidget.astro",
		"client:component-export": "default"
	})}</div></details></div><div style="display:flex;align-items:flex-end;gap:16px;padding-bottom:4px"><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" name="published" value="1"${addAttribute(initialPublished, "checked")} style="width:auto"> Publish</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" name="featured" value="1"${addAttribute(initialFeatured, "checked")} style="width:auto"> Featured</label></div></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/artikel" class="btn btn-outline">Batal</a></div></form>` })}${renderScript($$result, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/artikel/[id].astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/artikel/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/artikel/[id].astro";
var $$url = "/admin/artikel/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/artikel/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
