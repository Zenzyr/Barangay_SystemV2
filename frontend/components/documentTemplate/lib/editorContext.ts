import type { PageMetricsPx } from "./pageMetrics";

export class EditorContext {
  private known = new Set<string>();
  private metrics = { pageHeight: 0, topMargin: 0 };

  update(known: Set<string>, page: PageMetricsPx) {
    this.known = known;
    this.metrics = { pageHeight: page.height, topMargin: page.margins.top };
  }

  isKnown = (key: string) => this.known.has(key);
  getMetrics = () => this.metrics;
}
