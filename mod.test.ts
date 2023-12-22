import { assertLessOrEqual } from 'std/assert/mod.ts'
import { columns, filePath } from './data.ts'
import { isListicleLike } from './mod.ts'
import { parse } from 'std/csv/mod.ts'
import { Article } from './no_listicles/models/article.js'
import { Table } from 'cliffy/table/mod.ts'
import { colors } from 'cliffy/ansi/mod.ts'

const labeled = parse(await Deno.readTextFile(filePath), {
	skipFirstRow: true,
	columns,
})

const limits = {
	falsePositiveRate: 2.5 / 100,
	falseNegativeRate: 50 / 100,
}

const locale = new Intl.Locale('en-US')
const pctFmtOptions: Intl.NumberFormatOptions = { style: 'percent', maximumSignificantDigits: 3 }
const percentFmt = new Intl.NumberFormat(locale.toString(), pctFmtOptions)
const percentFmtWithSign = new Intl.NumberFormat(locale.toString(), { ...pctFmtOptions, signDisplay: 'always' })

function formatPercentWithSign(n: number) {
	const color = n > 0 ? 'green' : n < 0 ? 'red' : 'gray'
	return colors[color](percentFmtWithSign.format(n))
}

function fmtPcts(r: number, b: number, isBaseline: boolean) {
	return [percentFmt.format(r), !isBaseline && `(${formatPercentWithSign(r - b)})`].filter(Boolean).join(' ')
}

function getRates(r: Results) {
	const total = r.listicles.total + r.others.total
	const numOk = r.listicles.numOk + r.others.numOk
	const rate = numOk / total

	return { all: rate, listicles: r.listicles.rate, others: r.others.rate }
}

const baseline = {
	name: 'article.shouldRemove',
	fn(title: string) {
		const article = new Article(null, title)
		article.populateScore()
		return article.shouldRemove()
	},
} as const

const fns = { [baseline.name]: baseline.fn, isListicleLike }

type FnName = keyof typeof fns
type Fn = typeof fns[keyof typeof fns]
type Group = typeof labeled

const emptyResults = { numOk: -1, total: -1, rate: -1, failures: [] as string[] }
type ResultsForKind = typeof emptyResults
const results = Object.fromEntries(
	Object.keys(fns).map((k) => {
		return [k, {
			listicles: structuredClone(emptyResults),
			others: structuredClone(emptyResults),
		}]
	}),
) as Record<FnName, { listicles: ResultsForKind; others: ResultsForKind }>

type Results = { listicles: ResultsForKind; others: ResultsForKind }

const kinds = ['other', 'listicle'] as const
type Kind = typeof kinds[number]

const groupByListicality = (fn: (title: string) => boolean) => (x: { title: string }) => kinds[Number(fn(x.title))]

function runTest(fnName: FnName, fn: Fn, group: Group, expect: Kind) {
	const total = group.length

	const other = kinds.find((x) => x !== expect)!
	const fails = Object.groupBy(group, groupByListicality(fn))[other] ?? []

	const numOk = total - fails.length
	const rate = numOk / total
	const failures = fails.map((x) => x.title)

	assertLessOrEqual(1 - rate, limits[`false${expect === 'listicle' ? 'Negative' : 'Positive'}Rate`])

	results[fnName][`${expect}s`] = { numOk, total, rate, failures }
}

Deno.test('accuracy', async (t) => {
	for (const [name, fn] of Object.entries(fns)) {
		const fnName = name as FnName

		await t.step({
			name,
			async fn(t) {
				const { listicle = [], other = [] } = Object.groupBy(labeled, (x) => x.category)

				await t.step('listicles', () => {
					runTest(fnName, fn, listicle, 'listicle')
				})

				await t.step('others', () => {
					runTest(fnName, fn, other, 'other')
				})
			},
		})
	}

	await t.step({
		// ignore: true,
		name: 'results',
		async fn() {
			const r = results['article.shouldRemove']
			console.info(
				`\nResults (checked ${
					r.listicles.total + r.others.total
				} titles, of which ${r.listicles.total} listicles and ${r.others.total} other):\n`,
			)

			const header = ['Function', 'All', 'Listicles', 'Others'].map(colors.bold)

			const table = Table.from([
				header,
				...Object.keys(fns).toSorted((a, b) => Number(b === baseline.name) - Number(a === baseline.name)).map(
					(name) => {
						const fnName = name as FnName
						const isBaseline = fnName === baseline.name

						const r = getRates(results[fnName])
						const b = getRates(results[baseline.name])

						return [
							[colors.yellow(name), isBaseline && colors.gray('(baseline)')].filter(Boolean).join(' '),
							fmtPcts(r.all, b.all, isBaseline),
							fmtPcts(r.listicles, b.listicles, isBaseline),
							fmtPcts(r.others, b.others, isBaseline),
						]
					},
				),
			])
				.border()

			console.info(table.toString())

			const resultsFilePath = './results.json'
			await Deno.writeTextFile(resultsFilePath, JSON.stringify(results, null, '\t'))
			console.info(`\nSee ${colors.cyan.underline(resultsFilePath)} for details.\n`)
		},
	})
})
