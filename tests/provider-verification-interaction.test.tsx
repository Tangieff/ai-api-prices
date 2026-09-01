// @vitest-environment jsdom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVerificationRows, summariseVerification } from '@/lib/verification';
import { ProviderVerification } from '@/app/components/ProviderVerification';

/**
 * The behaviour a static render cannot reach: opening the drawer, closing it
 * three different ways, moving focus, locking the page behind it, and filtering.
 *
 * Only this file runs in jsdom; the rest of the suite stays in node.
 */

const rows = buildVerificationRows();
const summary = summariseVerification(rows);

let container: HTMLDivElement;
let root: Root;

function render(query = '') {
  act(() => {
    root.render(
      createElement(ProviderVerification, { rows, summary, query, onClearQuery: () => {} }),
    );
  });
}

function click(element: Element | null | undefined) {
  expect(element, 'element to click').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function press(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  });
}

function providerButtons() {
  return [...container.querySelectorAll<HTMLButtonElement>('table tbody tr td:first-child button')];
}

function dialog() {
  return container.querySelector<HTMLElement>('[role="dialog"]');
}

function chip(label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim().startsWith(label),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
});

describe('verification list interaction', () => {
  it('renders one activation button per provider and no drawer initially', () => {
    render();

    expect(providerButtons()).toHaveLength(rows.length);
    expect(dialog()).toBeNull();
  });

  it('opens the drawer for the provider whose row was activated', () => {
    render();
    const target = providerButtons()[2]!;
    const name = target.textContent;

    click(target);

    const panel = dialog();
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('h2')?.textContent).toBe(name);
    expect(target.getAttribute('aria-expanded')).toBe('true');
  });

  it('declares the popup and only points at the panel while it exists', () => {
    render();
    const target = providerButtons()[0]!;

    expect(target.getAttribute('aria-haspopup')).toBe('dialog');
    expect(target.getAttribute('aria-controls')).toBeNull();

    click(target);
    const controls = target.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(dialog()!.id).toBe(controls);
  });

  it('moves focus into the drawer and locks the page behind it', () => {
    render();
    click(providerButtons()[0]);

    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape, restores focus to the row, and unlocks the page', () => {
    render();
    const target = providerButtons()[1]!;
    click(target);

    press('Escape');

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(target);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes when the close button is used', () => {
    render();
    click(providerButtons()[0]);

    const close = [...dialog()!.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Close'),
    );
    click(close);

    expect(dialog()).toBeNull();
  });

  it('closes when the scrim behind the drawer is clicked', () => {
    render();
    click(providerButtons()[0]);

    const scrim = container.querySelector('button[aria-label="Close provider details"]');
    click(scrim);

    expect(dialog()).toBeNull();
  });

  it('keeps Tab inside the drawer', () => {
    render();
    click(providerButtons()[0]);

    const panel = dialog()!;
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const last = focusable[focusable.length - 1]!;

    act(() => last.focus());
    press('Tab');
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);

    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back in when it has escaped to the body', () => {
    render();
    click(providerButtons()[0]);
    const panel = dialog()!;

    act(() => (document.activeElement as HTMLElement | null)?.blur());
    press('Tab');

    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it('keeps the drawer open when the shared search stops matching the provider', () => {
    // The pricing page refreshes its data every five minutes and an agent tool
    // can drive the search box, so the open record must not vanish underfoot.
    render();
    click(providerButtons()[0]);
    const name = dialog()!.querySelector('h2')!.textContent;

    render('zzzznotaprovider');

    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('h2')!.textContent).toBe(name);
  });
});

describe('verification filters', () => {
  it('narrows the table to the rows a chip claims', () => {
    render();
    const before = providerButtons().length;

    const registered = chip('Independently registered')!;
    click(registered);

    expect(registered.getAttribute('aria-pressed')).toBe('true');
    expect(providerButtons().length).toBe(summary.verified_entity);
    expect(providerButtons().length).toBeLessThan(before);
  });

  it('closes an open drawer when the filter changes under it', () => {
    render();
    click(providerButtons()[0]);
    expect(dialog()).not.toBeNull();

    click(chip('Independently registered'));

    expect(dialog()).toBeNull();
  });

  it('narrows the table to the providers with a named public operator', () => {
    render();
    const operator = chip('Public operator')!;

    expect(summary.public_operator, 'this pass found public operators').toBeGreaterThan(0);
    expect(operator.hasAttribute('disabled')).toBe(false);

    click(operator);
    expect(providerButtons().length).toBe(
      rows.filter((row) => row.operator_name !== null || row.other_public_people.length > 0).length,
    );
  });

  it('disables a chip that matches nothing and leaves the table alone', () => {
    render();
    // Picked from the data rather than hardcoded: which chips are empty depends
    // on the research, and this assertion is about the disabled behaviour.
    const empty = [
      { label: 'Independently registered', count: summary.verified_entity },
      { label: 'Named company', count: summary.named_company },
      { label: 'Official code account', count: rows.filter((r) => r.official_presence.github).length },
    ].find((entry) => entry.count === 0);
    if (!empty) return;

    const button = chip(empty.label)!;
    expect(button.hasAttribute('disabled')).toBe(true);

    click(button);
    expect(providerButtons().length).toBe(rows.length);
  });

  it('returns to the full list from the empty state', () => {
    render('zzzznotaprovider');
    expect(providerButtons()).toHaveLength(0);

    const reset = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Show all providers',
    );
    expect(reset).toBeTruthy();

    render();
    expect(providerButtons()).toHaveLength(rows.length);
  });
});
