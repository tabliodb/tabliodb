# Tabliodb SDK Automation

Tabliodb SDK bisa dipakai dari script eksternal tanpa browser session cookie. Untuk automation, gunakan API key melalui header `x-api-key`; SDK akan memasangnya lewat `configureTabliodbSdk()`.

## Kapan Memakai API Key

Gunakan API key untuk:

- membaca daftar project dan diagram dari CI/internal tooling
- export diagram menjadi SQL/JSON/Markdown
- membuat snapshot automation
- integrasi dokumentasi internal

Jangan memakai API key untuk UI browser biasa. Browser UI tetap memakai session cookie HTTP-only dan session proof.

## Scope Minimal

Pilih permission sekecil mungkin:

- List project: `project.read`
- List diagram dalam project: `diagram.read`
- Export diagram: `diagram.read`
- Create snapshot: `snapshot.create`
- Update/import diagram: `diagram.update`

Jika automation hanya perlu membaca desain database, biasanya cukup:

```txt
project.read
diagram.read
snapshot.read
```

## Contoh Script Node

```ts
import { configureTabliodbSdk, getProjectDiagrams, getProjects } from '@tabliodb/sdk';

configureTabliodbSdk({
  apiKey: process.env.TABLIODB_API_KEY,
  baseUrl: process.env.TABLIODB_API_URL ?? 'http://localhost:3000/api',
  // Automation Node tidak membutuhkan cookie browser.
  credentials: 'omit',
});

const projects = await getProjects({
  limit: 20,
});

for (const project of projects.items) {
  console.log(`${project.name} (${project.id})`);

  const diagrams = await getProjectDiagrams({
    projectId: project.id,
    limit: 20,
  });

  for (const diagram of diagrams.items) {
    console.log(`  - ${diagram.name} (${diagram.id})`);
  }
}
```

## Catatan Keamanan

- Simpan API key di secret manager atau environment variable.
- Buat API key per integrasi, bukan satu key dipakai semua script.
- Jangan commit API key ke repository.
- Rotasi API key jika sudah pernah terlihat di terminal log, CI log, screenshot, atau file `.env`.
- Gunakan permission minimal agar key yang bocor tidak bisa mengubah diagram.
