import {
    makeBlockMathInputRule,
    makeInlineMathInputRule,
    REGEX_BLOCK_MATH_DOLLARS,
    REGEX_INLINE_MATH_DOLLARS,
} from '@benrbray/prosemirror-math';
import { Node, SerializerNode } from '@milkdown/core';
import type { InputRule } from 'prosemirror-inputrules';
import type { NodeSpec, NodeType } from 'prosemirror-model';

export class MathInline extends Node {
    override id = 'math_inline';
    override schema: NodeSpec = {
        group: 'inline math',
        content: 'text*',
        inline: true,
        atom: true,
        parseDOM: [{ tag: 'math-inline' }],
        toDOM: () => ['math-inline', { class: 'math-node' }, 0],
    };
    override parser = {
        block: this.id,
        isAtom: true,
    };
    override serializer: SerializerNode = (state, node) => {
        state.write('$');
        state.renderContent(node);
        state.write('$');
    };
    override inputRules = (nodeType: NodeType): InputRule[] => [
        makeInlineMathInputRule(REGEX_INLINE_MATH_DOLLARS, nodeType),
    ];
}

export class MathDisplay extends Node {
    override id = 'math_display';
    override schema: NodeSpec = {
        group: 'block math',
        content: 'text*',
        atom: true,
        code: true,
        parseDOM: [{ tag: 'math-display' }],
        toDOM: () => ['math-display', { class: 'math-node' }, 0],
    };
    override parser = {
        block: 'math_block',
        isAtom: true,
    };
    override serializer: SerializerNode = (state, node) => {
        state.write('$$').ensureNewLine().renderContent(node).ensureNewLine().write('$$').closeBlock(node);
    };
    override inputRules = (nodeType: NodeType): InputRule[] => [
        makeBlockMathInputRule(REGEX_BLOCK_MATH_DOLLARS, nodeType),
    ];
}

export const nodes = [new MathInline(), new MathDisplay()];
