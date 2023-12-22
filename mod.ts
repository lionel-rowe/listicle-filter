const re = new RegExp(
	String.raw`
        (?:                               # location within the title:
            ^                             # - at the start
            | (?:                         # - any of the following:
                : | - | —                 #     - after certain punctuation (start of subtitle)
                | \p{RGI_Emoji}           #     - after emoji
                | the | top | mastering   #     - words often found before the number in listicles
                | these | my | best
            ) [^\p{L}\p{M}\p{N}]          #   ...followed by a non-word character (punctuation etc)
        )
        [^\p{L}\p{M}\p{N}]*               #   ...followed by 0 or more non-word characters
        (?:
            [2-9]                         # single digit 2..9
            | \d{2,3}                     # 2 or 3 digits (4 digits is most likely a year e.g. "2023")
            | two | three | four          # number words 2..10
            | five | six | seven
            | eight | nine | ten
        )
        [\p{Zs}+]                         # followed by whitespace or certain punctuation
    `
		// strip whitespace and comments from preceding regex source
		.replaceAll(/\s+|#.*$/gm, ''),
	// case insensitive and unicode ("unicode-sets") aware
	'iv',
)

export const isListicleLike = re.test.bind(re)
