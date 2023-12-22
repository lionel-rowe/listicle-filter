import { retry } from 'std/async/retry.ts'

const results = (await Promise.all(
	Array.from({ length: 100 }, async (_, i) => {
		const pageNum = i + 1

		const url = new URL('https://dev.to/api/articles')
		url.searchParams.set('page', String(pageNum))

		return await retry(async () => {
			const res = await fetch(url)
			if (!res.ok) throw new Error(`Server returned ${res.status}`)

			return res.json()
		}, { maxAttempts: 10 })
	}),
)).flat()

await Deno.writeTextFile('./articles.json', JSON.stringify(results, null, '\t'))
