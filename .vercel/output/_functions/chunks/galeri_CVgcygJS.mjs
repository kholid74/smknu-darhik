import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { t as $$BaseLayout } from "./BaseLayout_wtbOOnCb.mjs";
//#region src/pages/galeri.astro
var galeri_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Galeri,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Galeri = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Galeri;
	const album = new URL(Astro.request.url).searchParams.get("album") || "";
	const allImages = await db.galleryImage.findMany({ orderBy: { createdAt: "desc" } });
	const albums = [...new Set(allImages.map((i) => i.album).filter(Boolean))];
	const images = album ? allImages.filter((i) => i.album === album) : allImages;
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": "Galeri Foto",
		"description": "Galeri foto kegiatan dan fasilitas SMKS NU Darul Hikam Karanggeneng."
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<section class="relative bg-[#145a2d] overflow-hidden"><div class="absolute inset-0 bg-[#145a2d]"></div><div class="relative z-10 px-4 md:px-6 max-w-3xl mx-auto py-16 md:py-20 text-white text-center"><nav class="flex items-center justify-center gap-2 text-sm text-white/70 mb-4"><a href="/" class="hover:text-white">Beranda</a><span class="material-symbols-outlined text-sm">chevron_right</span><span class="text-white font-medium">Galeri Foto</span></nav><h1 class="text-3xl md:text-4xl font-extrabold leading-tight mb-3">Galeri Foto</h1><p class="text-base md:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">Dokumentasi kegiatan, fasilitas, dan kehidupan di SMKS NU Darul Hikam.</p></div></section><section class="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16"><!-- Filter Albums -->${albums.length > 0 && renderTemplate`<div class="flex flex-wrap gap-2 justify-center mb-10"><a href="/galeri"${addAttribute(`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${!album ? "bg-[#1B7A3D] text-white" : "bg-white border border-black/10 text-[#3f493f] hover:border-[#1B7A3D]"}`, "class")}>Semua</a>${albums.map((a) => renderTemplate`<a${addAttribute(`/galeri?album=${encodeURIComponent(a)}`, "href")}${addAttribute(`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${album === a ? "bg-[#1B7A3D] text-white" : "bg-white border border-black/10 text-[#3f493f] hover:border-[#1B7A3D]"}`, "class")}>${a}</a>`)}</div>`}${images.length === 0 ? renderTemplate`<p class="text-center text-[#6f7a6e] py-16">Belum ada foto. Admin bisa upload melalui admin panel.</p>` : renderTemplate`<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">${images.map((img) => renderTemplate`<a${addAttribute(img.imageUrl, "href")} target="_blank" rel="noopener" class="group block rounded-xl overflow-hidden bg-white border border-black/5 shadow-[0_2px_8px_rgba(27,122,61,0.04)] hover:shadow-[0_8px_24px_rgba(27,122,61,0.12)] transition-shadow"><div class="aspect-square overflow-hidden bg-[#e8f5e9]"><img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"${addAttribute(img.imageUrl, "src")}${addAttribute(img.title || "Foto", "alt")} loading="lazy" onerror="this.style.display='none'"></div>${img.title && renderTemplate`<div class="p-3"><p class="text-xs font-semibold text-[#1c1b1b] line-clamp-1">${img.title}</p>${img.album && renderTemplate`<p class="text-[10px] text-[#6f7a6e] mt-0.5">${img.album}</p>`}</div>`}</a>`)}</div>`}</section>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/galeri.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/galeri.astro";
var $$url = "/galeri";
//#endregion
//#region \0virtual:astro:page:src/pages/galeri@_@astro
var page = () => galeri_exports;
//#endregion
export { page };
