import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, formatCompactNumber, formatNumber, renderHighlightLine } from "../src/report-util.js";

test("formatNumber uses Korean grouping", () => {
  assert.equal(formatNumber(446_166), "446,166");
});

test("formatCompactNumber uses 만·억 not k/M", () => {
  assert.equal(formatCompactNumber(446_166), "44.6만");
  assert.equal(formatCompactNumber(12_000), "1.2만");
  assert.equal(formatCompactNumber(5_000), "5,000");
  assert.equal(formatCompactNumber(120_000_000), "1.2억");
  assert.ok(!/[kM]/i.test(formatCompactNumber(99_999)));
});

test("renderHighlightLine converts **bold** to strong", () => {
  assert.equal(renderHighlightLine("**키워드**가 핵심"), "<strong>키워드</strong>가 핵심");
});

test("renderHighlightLine preserves masked display names", () => {
  assert.equal(
    renderHighlightLine("**김***철**님이 **활발**"),
    "<strong>김***철</strong>님이 <strong>활발</strong>",
  );
  assert.equal(renderHighlightLine("김*철과 이*영이 대화"), "김*철과 이*영이 대화");
});

test("renderHighlightLine does not treat markdown closers as mask stars", () => {
  assert.equal(renderHighlightLine("**키워드**가 핵심"), "<strong>키워드</strong>가 핵심");
});

test("renderHighlightLine escapes HTML outside bold", () => {
  assert.equal(renderHighlightLine("<script> & **x**"), "&lt;script&gt; &amp; <strong>x</strong>");
});

test("escapeHtml still works for plain fields", () => {
  assert.equal(escapeHtml("김*철"), "김*철");
});
