import { t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, c as renderSlot, d as renderTemplate, g as renderHead } from "./server_C1dVeAgT.mjs";
import { n as site, r as renderScript } from "./site_BD_vKQs6.mjs";
//#region src/layouts/AdminLayout.astro
createAstro("https://astro.build");
var $$AdminLayout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$AdminLayout;
	const { title, user } = Astro.props;
	const currentPath = Astro.url.pathname;
	const groups = [
		{
			label: "Konten",
			icon: "edit_note",
			items: [
				{
					label: "Artikel",
					href: "/admin/artikel"
				},
				{
					label: "Halaman Statis",
					href: "/admin/halaman"
				},
				{
					label: "Pengumuman",
					href: "/admin/pengumuman"
				}
			]
		},
		{
			label: "Sekolah",
			icon: "school",
			items: [
				{
					label: "Jurusan",
					href: "/admin/jurusan"
				},
				{
					label: "Guru & Staf",
					href: "/admin/guru"
				},
				{
					label: "Fasilitas",
					href: "/admin/fasilitas"
				},
				{
					label: "Ekstrakurikuler",
					href: "/admin/ekskul"
				},
				{
					label: "Mitra Industri",
					href: "/admin/mitra"
				}
			]
		},
		{
			label: "Prestasi & Bukti",
			icon: "emoji_events",
			items: [
				{
					label: "Prestasi",
					href: "/admin/prestasi"
				},
				{
					label: "Testimoni",
					href: "/admin/testimoni"
				},
				{
					label: "FAQ",
					href: "/admin/faq"
				}
			]
		},
		{
			label: "Media",
			icon: "perm_media",
			items: [{
				label: "Galeri Foto",
				href: "/admin/galeri"
			}, {
				label: "Download",
				href: "/admin/download"
			}]
		},
		{
			label: "Pengaturan",
			icon: "settings",
			items: [{
				label: "Informasi Sekolah",
				href: "/admin/pengaturan"
			}, ...user?.role === "superadmin" ? [{
				label: "Pengguna",
				href: "/admin/pengguna"
			}] : []]
		}
	];
	return renderTemplate`<html lang="id" data-astro-cid-w6su3bgr><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} — Admin ${site.shortName}</title><link rel="icon" type="image/png" href="/assets/logo.png"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">${renderHead($$result)}</head><body data-astro-cid-w6su3bgr><!-- Sidebar --><aside class="sidebar" data-astro-cid-w6su3bgr><div style="padding:20px 16px;border-bottom:1px solid rgba(255,255,255,0.1);text-align:center" data-astro-cid-w6su3bgr><img src="/assets/logo.png" alt="Logo" style="width:48px;height:48px;margin-bottom:8px" data-astro-cid-w6su3bgr><div style="font-size:15px;font-weight:800" data-astro-cid-w6su3bgr>${site.shortName}</div><div style="font-size:11px;color:rgba(255,255,255,0.5)" data-astro-cid-w6su3bgr>Admin Panel</div></div><nav style="flex:1;padding:8px" data-astro-cid-w6su3bgr><a href="/admin"${addAttribute(["", { active: currentPath === "/admin" }], "class:list")} data-astro-cid-w6su3bgr><span class="material-symbols-outlined" data-astro-cid-w6su3bgr>dashboard</span> Dashboard</a>${groups.map((g) => renderTemplate`<div data-astro-cid-w6su3bgr><div class="sidebar-group-label" data-astro-cid-w6su3bgr>${g.label}</div>${g.items.map((i) => renderTemplate`<a${addAttribute(i.href, "href")}${addAttribute([{ active: currentPath.startsWith(i.href) }], "class:list")} data-astro-cid-w6su3bgr>${i.label}</a>`)}</div>`)}</nav><div style="padding:16px;border-top:1px solid rgba(255,255,255,0.1)" data-astro-cid-w6su3bgr><a href="/" target="_blank" style="font-size:12px;color:rgba(255,255,255,0.6)" data-astro-cid-w6su3bgr><span class="material-symbols-outlined" style="font-size:16px" data-astro-cid-w6su3bgr>open_in_new</span> Lihat Website</a><a href="/admin/logout" id="logout-link" style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;cursor:pointer" data-astro-cid-w6su3bgr><span class="material-symbols-outlined" style="font-size:16px" data-astro-cid-w6su3bgr>logout</span> Keluar</a><!-- Custom Logout Modal --><div id="logout-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:center;justify-content:center" data-astro-cid-w6su3bgr><div style="background:white;border-radius:16px;padding:32px;max-width:360px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2)" data-astro-cid-w6su3bgr><span class="material-symbols-outlined" style="font-size:48px;color:#C8963E;margin-bottom:12px" data-astro-cid-w6su3bgr>logout</span><h3 style="font-size:18px;font-weight:800;margin-bottom:8px;color:#1c1b1b" data-astro-cid-w6su3bgr>Yakin ingin keluar?</h3><p style="font-size:14px;color:#6f7a6e;margin-bottom:24px" data-astro-cid-w6su3bgr>Kamu akan diarahkan ke halaman login.</p><div style="display:flex;gap:10px;justify-content:center" data-astro-cid-w6su3bgr><button onclick="document.getElementById('logout-modal').style.display='none'" style="padding:10px 24px;border:1px solid #d1d5db;border-radius:10px;background:white;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:#3f493f" data-astro-cid-w6su3bgr>Batal</button><a href="/admin/logout" style="padding:10px 24px;border-radius:10px;background:#dc2626;color:white;font-size:14px;font-weight:700;text-decoration:none;display:inline-block" data-astro-cid-w6su3bgr>Keluar</a></div></div></div>${renderScript($$result, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/layouts/AdminLayout.astro?astro&type=script&index=0&lang.ts")}</div></aside><!-- Shared Delete Confirm Modal --><div id="delete-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:110;align-items:center;justify-content:center" data-astro-cid-w6su3bgr><div style="background:white;border-radius:16px;padding:32px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2)" data-astro-cid-w6su3bgr><span class="material-symbols-outlined" style="font-size:48px;color:#dc2626;margin-bottom:12px" data-astro-cid-w6su3bgr>delete_forever</span><h3 style="font-size:18px;font-weight:800;margin-bottom:8px;color:#1c1b1b" data-astro-cid-w6su3bgr>Hapus data ini?</h3><p style="font-size:14px;color:#6f7a6e;margin-bottom:24px" data-astro-cid-w6su3bgr>Tindakan ini tidak dapat dibatalkan.</p><div style="display:flex;gap:10px;justify-content:center" data-astro-cid-w6su3bgr><button onclick="document.getElementById('delete-modal').style.display='none'" style="padding:10px 24px;border:1px solid #d1d5db;border-radius:10px;background:white;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;color:#3f493f" data-astro-cid-w6su3bgr>Batal</button><button id="delete-confirm-btn" style="padding:10px 24px;border-radius:10px;background:#dc2626;color:white;font-size:14px;font-weight:700;cursor:pointer;border:none;font-family:inherit" data-astro-cid-w6su3bgr>Hapus</button></div></div></div><!-- Flash Message -->${Astro.url.searchParams.get("saved") && renderTemplate`<div id="flash-msg" style="position:fixed;top:16px;right:16px;z-index:120;background:#1B7A3D;color:white;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.15);display:flex;align-items:center;gap:8px;animation:fadeIn 0.3s" data-astro-cid-w6su3bgr><span class="material-symbols-outlined" data-astro-cid-w6su3bgr>check_circle</span> Berhasil disimpan</div>`}<!-- Main --><div class="main-content" data-astro-cid-w6su3bgr><div class="topbar" data-astro-cid-w6su3bgr><div style="font-weight:700;font-size:15px" data-astro-cid-w6su3bgr>${title}</div><div style="font-size:12px;color:#6f7a6e;display:flex;align-items:center;gap:12px" data-astro-cid-w6su3bgr><span data-astro-cid-w6su3bgr>${(/* @__PURE__ */ new Date()).toLocaleDateString("id", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric"
	})}</span><span style="background:#e8f5e9;color:#1B7A3D;padding:2px 10px;border-radius:100px;font-weight:600" data-astro-cid-w6su3bgr>${user?.role === "superadmin" ? "Super Admin" : "Editor"}</span></div></div><div class="page-body" data-astro-cid-w6su3bgr>${renderSlot($$result, $$slots["default"])}</div></div>${renderScript($$result, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/layouts/AdminLayout.astro?astro&type=script&index=1&lang.ts")}</body></html>`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/layouts/AdminLayout.astro", void 0);
//#endregion
export { $$AdminLayout as t };
