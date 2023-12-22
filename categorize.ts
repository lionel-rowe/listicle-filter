import { parse, stringify } from 'std/csv/mod.ts'
import { assertEquals } from 'std/assert/mod.ts'
import articles from './articles.json' with { type: 'json' }
import { columns, filePath } from './data.ts'
import { Checkbox } from 'cliffy/prompt/mod.ts'

const labeled = parse(await Deno.readTextFile(filePath), {
	skipFirstRow: true,
	columns,
})

// if assertion fails, data has been updated or become corrupted
for (const [idx, { title }] of labeled.entries()) {
	assertEquals(title, articles[idx].title)
}

function chunkBySize<T>(arr: T[], n: number) {
	return Object.values(Object.groupBy(arr, (_, i) => Math.floor(i / n)))
}

for (const chunk of chunkBySize(articles.slice(labeled.length), 10)) {
	console.clear()
	const titles = chunk.map((x) => x.title)

	const listicles = await Checkbox.prompt({
		message: 'Which are listicles?',
		options: titles,
	})

	for (const title of titles) {
		labeled.push({ title, category: listicles.includes(title) ? 'listicle' : 'other' })
	}

	await Deno.writeTextFile(filePath, stringify(labeled, { columns }))
}
