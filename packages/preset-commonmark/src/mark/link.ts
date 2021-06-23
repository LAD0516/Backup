import type { MarkSpec, MarkType, Schema } from 'prosemirror-model';
import { SerializerMark, ParserSpec } from '@milkdown/core';
import { InputRule } from 'prosemirror-inputrules';
import { CommonMark } from '../utility';

export class Link extends CommonMark {
    override readonly id = 'link';
    override readonly schema: MarkSpec = {
        attrs: {
            href: {},
            title: { default: null },
        },
        inclusive: false,
        parseDOM: [
            {
                tag: 'a[href]',
                getAttrs: (dom) => {
                    if (!(dom instanceof HTMLElement)) {
                        throw new Error();
                    }
                    return { href: dom.getAttribute('href'), title: dom.getAttribute('title') };
                },
            },
        ],
        toDOM: (mark) => ['a', { ...mark.attrs, class: this.getClassName(mark.attrs) }],
    };
    override readonly parser: ParserSpec = {
        mark: 'link',
        getAttrs: (tok) => ({
            href: tok.attrGet('href'),
            title: tok.attrGet('title') || null,
        }),
    };
    override readonly serializer: SerializerMark = {
        open: () => '[',
        close: (state, mark) => {
            const link = state.utils.escape(mark.attrs.href);
            const title = mark.attrs.title ? ` ${state.utils.quote(mark.attrs.title)}` : '';

            return `](${link}${title})`;
        },
        priority: 1,
    };
    override readonly inputRules = (markType: MarkType, schema: Schema) => [
        new InputRule(/\[(?<text>.+?)]\((?<href>.*?)(?=“|\))"?(?<title>[^"]+)?"?\)/, (state, match, start, end) => {
            const [okay, text = '', href, title] = match;
            const { tr } = state;
            if (okay) {
                tr.replaceWith(start, end, schema.text(text)).addMark(
                    start,
                    text.length + start,
                    markType.create({ title, href }),
                );
            }

            return tr;
        }),
    ];
}