import { v as createRenderInstruction } from "./server_C1dVeAgT.mjs";
//#region node_modules/astro/dist/runtime/server/render/script.js
async function renderScript(result, id) {
	const inlined = result.inlinedScripts.get(id);
	let content = "";
	if (inlined != null) {
		if (inlined) content = `<script type="module">${inlined}<\/script>`;
	} else {
		const resolved = await result.resolve(id);
		content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"><\/script>`;
	}
	return createRenderInstruction({
		type: "script",
		id,
		content
	});
}
//#endregion
//#region src/data/site.ts
var site = {
	name: "SMKS NU Darul Hikam",
	shortName: "SMKS NU DH",
	tagline: "Terampil, Beriman, Siap Kerja",
	location: "Karanggeneng, Lamongan",
	address: "Jl. Sultan Hasanuddin No.44, Tracal, Kec. Karanggeneng, Kab. Lamongan, Jawa Timur 62254",
	phone: "0822 2782 5878",
	email: "smknudarulhikam@gmail.com",
	wa: "082227825878",
	founded: "2010",
	accreditation: "A"
};
var nav = {
	main: [
		{
			label: "Beranda",
			href: "/"
		},
		{
			label: "Profil",
			children: [
				{
					label: "Tentang Sekolah",
					href: "/profil"
				},
				{
					label: "Visi & Misi",
					href: "/profil#visi"
				},
				{
					label: "Struktur Sekolah",
					href: "/struktur"
				},
				{
					label: "Guru & Staf",
					href: "/guru"
				}
			]
		},
		{
			label: "Akademik",
			children: [
				{
					label: "Program Keahlian",
					href: "/jurusan"
				},
				{
					label: "PKL / Magang",
					href: "/pkl"
				},
				{
					label: "Ekstrakurikuler",
					href: "/ekskul"
				},
				{
					label: "Fasilitas",
					href: "/fasilitas"
				}
			]
		},
		{
			label: "Informasi",
			children: [
				{
					label: "Berita & Kegiatan",
					href: "/berita"
				},
				{
					label: "Galeri Foto",
					href: "/galeri"
				},
				{
					label: "FAQ",
					href: "/faq"
				},
				{
					label: "Download",
					href: "/download"
				},
				{
					label: "Alumni",
					href: "/alumni"
				}
			]
		},
		{
			label: "PPDB",
			href: "/ppdb"
		},
		{
			label: "Kontak",
			href: "/kontak"
		}
	],
	footer: [
		{
			label: "Beranda",
			href: "/"
		},
		{
			label: "Profil",
			href: "/profil"
		},
		{
			label: "Program Keahlian",
			href: "/jurusan"
		},
		{
			label: "PPDB",
			href: "/ppdb"
		},
		{
			label: "Kontak",
			href: "/kontak"
		}
	]
};
//#endregion
export { site as n, renderScript as r, nav as t };
