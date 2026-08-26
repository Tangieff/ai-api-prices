/**
 * Generate synthetic parser fixtures.
 *
 * These replace captures of third-party pricing pages. Each one reproduces only
 * the structure the corresponding parser keys on — the table, the cells, the
 * attribute names — with our own minimal markup and no provider page content,
 * branding, styling or copy. Model identifiers and prices are factual data and
 * are kept so the existing assertions continue to prove the same behaviour.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
const write = (name, body) => {
  writeFileSync(path.join(OUT, name), `${body.trim()}\n`, 'utf8');
  console.log(`wrote ${name}`);
};

const banner = (provider) =>
  `<!-- Synthetic fixture. Reproduces the ${provider} parser's expected structure only. Not a capture of any third-party page. -->`;

const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
const head = (cells) => `<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`;

// ---------------------------------------------------------------- derouter
// Model | Input | Output | Cache R | Cache W | Official I/O | Save
{
  const models = [
    ['Claude Fable 5', '2.32', '11.62', '0.23', '2.90', '$10 / $50', '77'],
    ['Claude Opus 5', '1.16', '5.81', '0.12', '1.45', '$5 / $25', '77'],
    ['Claude Opus 4.8', '1.16', '5.81', '0.12', '1.45', '$5 / $25', '77'],
    ['Claude Opus 4.7', '1.16', '5.81', '0.12', '1.45', '$5 / $25', '77'],
    ['Claude Opus 4.6', '1.16', '5.81', '0.12', '1.45', '$5 / $25', '77'],
    ['Claude Sonnet 4.6', '0.70', '3.48', '0.070', '0.87', '$3 / $15', '77'],
    ['Claude Sonnet 5', '0.46', '2.32', '0.046', '0.58', '$2 / $10', '77'],
    ['Claude Haiku 4.5', '0.23', '1.16', '0.023', '0.29', '$1 / $5', '77'],
    ['GPT-5.6 Sol', '0.48', '2.85', '0.048', '0.59', '$5 / $30', '90'],
    ['GPT-5.5', '0.48', '2.85', '0.048', '0.048', '$5 / $30', '90'],
    ['GPT-5.4', '0.24', '1.43', '0.024', '0.024', '$2.5 / $15', '90'],
    ['GPT-5.6 Terra', '0.19', '1.14', '0.019', '0.24', '$2 / $12', '90'],
  ];
  write(
    'derouter-pricing.html',
    `${banner('derouter.ai')}
<table>
<thead>${head(['Model', 'Input', 'Output', 'Cache R', 'Cache W', 'Official I/O', 'Save'])}</thead>
<tbody>
${models
  .map(([name, i, o, cr, cw, official, save]) =>
    row([`<span>${name}</span>`, `$${i}`, `$${o}`, `$${cr}`, `$${cw}`, official, `<span>−${save}%</span>`]),
  )
  .join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- getgoapi
// Status | Model Name | Provider | Context Window | Input Price | Output Price
{
  const models = [
    ['claude-opus-4-6', 'Anthropic', '200K', '4.00', '20.00'],
    ['claude-sonnet-5', 'Anthropic', '200K', '1.60', '8.00'],
    ['gpt-5.6-sol', 'OpenAI', '272K', '3.20', '16.00'],
    ['gemini-3.1-pro', 'Google', '1M', '1.00', '6.00'],
    // Media products: present so the text-token filter is genuinely exercised.
    ['grok-2-image-1212', 'xAI', '—', '0.07', '0.07'],
    ['grok-imagine-video', 'xAI', '—', '0.10', '0.10'],
  ];
  write(
    'getgoapi-models.html',
    `${banner('GetGoAPI')}
<table>
<thead>${head(['Status', 'Model Name', 'Provider', 'Context Window', 'Input Price', 'Output Price'])}</thead>
<tbody>
${models
  .map(([id, vendor, ctx, i, o]) =>
    row(['Available', id, vendor, ctx, `$${i} / 1M tokens`, `$${o} / 1M tokens`]),
  )
  .join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- worldgate
// Prices come from data-price-usd attributes, not the rendered text.
{
  const models = [
    ['Claude Fable 5', 0.52, 3.12, 0.052, 0.65],
    ['Claude Opus 5', 0.26, 1.56, 0.026, 0.33],
    ['Claude Opus 4.8', 0.26, 1.56, 0.026, 0.33],
    ['Claude Opus 4.6', 0.26, 1.56, 0.026, 0.33],
    ['Claude Sonnet 5', 0.104, 0.52, 0.0104, 0.13],
    ['Claude Sonnet 4.6', 0.156, 0.78, 0.0156, 0.195],
    ['Claude Haiku 4.5', 0.052, 0.26, 0.0052, 0.065],
    ['GPT 5.6 Sol', 0.26, 1.56, 0.026, 0.33],
    ['GPT 5.6 Terra', 0.104, 0.62, 0.0104, 0.13],
    ['GPT 5.6 Luna', 0.0104, 0.062, 0.001, 0.013],
    ['GPT 5.5', 0.325, 1.95, 0.0325, 0.41],
    ['GPT 5.4', 0.13, 0.78, 0.013, 0.163],
    ['Gemini 3.1 Pro', 0.065, 0.52, 0.0065, 0.081],
    ['Gemini 3.1 Flash', 0.0156, 0.104, 0.0016, 0.02],
    ['Grok 4.6', 0.104, 0.312, 0.0104, 0.13],
    ['Grok 4.5', 0.104, 0.312, 0.0104, 0.13],
    ['Kimi K3', 0.078, 0.39, 0.0078, 0.098],
    ['Kimi K2.6', 0.052, 0.26, 0.0052, 0.065],
    ['GLM 5.2', 0.039, 0.156, 0.0039, 0.049],
    ['GLM 5.1', 0.026, 0.104, 0.0026, 0.033],
    ['DeepSeek V4 Pro', 0.065, 0.26, 0.0065, 0.081],
    ['DeepSeek V4 Flash', 0.013, 0.052, 0.0013, 0.016],
    ['MiniMax M3', 0.026, 0.104, 0.0026, 0.033],
    ['MiniMax M2.7', 0.021, 0.083, 0.0021, 0.026],
    ['Qwen 3.8 Max', 0.156, 0.624, 0.0156, 0.195],
    // Rendered text is deliberately stale here; the attribute must win.
    ['Qwen 3.7 Max', 1.3, 5.2, 0.13, 1.63, '$1.50'],
  ];
  const priceCell = (value, staleText) =>
    `<td data-price-usd="${value}">${staleText ?? `$${value}`}</td>`;
  write(
    'worldgate-home.html',
    `${banner('WorldGate')}
<table>
<thead>${head(['Model', 'Input', 'Output', 'Cache read', 'Cache write'])}</thead>
<tbody>
${models
  .map(
    ([name, i, o, cr, cw, stale]) =>
      `<tr><td>${name}</td>${priceCell(i, stale)}${priceCell(o)}${priceCell(cr)}${priceCell(cw)}</tr>`,
  )
  .join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- boundless
// Model | Context | Price (in/out) | Official (in/out) | Notes | Save | Status
{
  const live = [
    ['gpt-5.6-sol', '$1.25 / $7.5', '$2.5 / $15'],
    ['gpt-5.6-terra', '$1 / $6', '$2 / $12'],
    ['gpt-5.5', '$3.13 / $18.75', '$6.25 / $37.5'],
    ['claude-opus-5', '$2.5 / $12.5', '$5 / $25'],
    ['claude-fable-5', '$5 / $25', '$10 / $50'],
    ['claude-sonnet-5', '$1 / $5', '$2 / $10'],
    ['claude-haiku-4.5', '$0.5 / $2.5', '$1 / $5'],
    ['gemini-3.1-pro', '$0.625 / $5', '$1.25 / $10'],
    ['gemini-3.1-flash', '$0.15 / $1.2', '$0.3 / $2.4'],
    ['grok-4.6', '$1 / $3', '$2 / $6'],
    ['deepseek-v4-pro', '$0.375 / $2.25', '$0.75 / $4.5'],
    ['kimi-k3', '$0.3 / $1.5', '$0.6 / $3'],
    ['glm-5.2', '$0.2 / $0.8', '$0.4 / $1.6'],
  ];
  const skipped = [
    // Not live: must be excluded even though it is token-priced.
    ['claude-opus-4-6', '$2.5 / $12.5', '$5 / $25', 'Deprecated'],
    // Live, but per-image billing is not a token pair.
    ['veo-3.1-video-audio', '$0.05 / img', '—', 'Live'],
  ];
  write(
    'boundless-models.html',
    `${banner('Boundless API')}
<table>
<thead>${head(['Model', 'Context', 'Price', 'Official', 'Notes', 'Save', 'Status'])}</thead>
<tbody>
${live.map(([id, price, official]) => row([id, '200K', price, official, '—', '−50%', 'Live'])).join('\n')}
${skipped.map(([id, price, official, status]) => row([id, '200K', price, official, '—', '−50%', status])).join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- llmsrelay
// Two tables: the usage packs, then the platform rate card.
{
  const packs = [
    ['$45', '$500 usage balance'],
    ['$90', '$1000 usage balance'],
    ['$450', '$5000 usage balance'],
  ];
  const rates = [
    ['claude-fable-5', '10', '50', '12.5', '1'],
    ['claude-opus-5', '5', '25', '6.25', '0.5'],
    ['claude-opus-4.8', '5', '25', '6.25', '0.5'],
    ['claude-opus-4.6', '5', '25', '6.25', '0.5'],
    ['claude-sonnet-5', '2', '10', '2.5', '0.2'],
    ['claude-sonnet-4.6', '3', '15', '3.75', '0.3'],
    ['claude-haiku-4.5', '1', '5', '1.25', '0.1'],
    ['claude-haiku-4', '0.8', '4', '1', '0.08'],
  ];
  write(
    'llmsrelay-pricing.html',
    `${banner('LLMsRelay')}
<table>
<thead>${head(['Pay', 'Receive'])}</thead>
<tbody>
${packs.map((cells) => row(cells)).join('\n')}
</tbody>
</table>
<table>
<thead>${head(['Model', 'Input', 'Output', 'Cache write', 'Cache read'])}</thead>
<tbody>
${rates.map(([id, i, o, cw, cr]) => row([id, `$${i}`, `$${o}`, `$${cw}`, `$${cr}`])).join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- cometapi
// A minimal React flight stream carrying one text model and one media model.
{
  const lines = [
    `1:${JSON.stringify({
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      model_type: 'text',
      pricing: '$2',
      official_pricing: '$3',
    })}`,
    `2:${JSON.stringify({ input: 0.75, output: 3.75, ratio: 0.8 })}`,
    `3:${JSON.stringify({ input: 1, output: 5 })}`,
    // Media product: filtered out by model_type.
    `4:${JSON.stringify({ id: 'veo-3.1', model_type: 'video', pricing: '$5' })}`,
    `5:${JSON.stringify({ per_request: 0.4 })}`,
  ];
  const frames = lines
    .map((line) => `<script>self.__next_f.push(${JSON.stringify([1, `${line}\n`])})</script>`)
    .join('\n');
  write('cometapi-pricing.html', `${banner('CometAPI')}\n${frames}`);
}

// ---------------------------------------------------------------- omniakey
// Model cards: <a class="group grid"> with an <h3> name, a font-mono id and
// four "$x USD" values in order input, official input, output, official output.
{
  const cards = [
    ['Claude Opus 5', 'claude-opus-5', 1.2, 5, 6, 25],
    ['Claude Sonnet 5', 'claude-sonnet-5', 0.48, 2, 2.4, 10],
  ];
  write(
    'omniakey-models.html',
    `${banner('OmniaKey')}
${cards
  .map(
    ([name, id, i, refI, o, refO]) =>
      `<a class="group grid" href="/models/${id}">
  <h3>${name}</h3>
  <p class="font-mono">${id}</p>
  <span>Input $${i} USD</span><span>was $${refI} USD</span>
  <span>Output $${o} USD</span><span>was $${refO} USD</span>
</a>`,
  )
  .join('\n')}`,
  );
}

// ------------------------------------------------------------- relayrouter
// One explicit USD direct route, plus ratio-only pools that must be rejected.
{
  write(
    'relayrouter-models.html',
    `${banner('RelayRouter')}
<ul>
<li>deepseek-v4-flash text $0.162 in / 1M · $0.324 out / 1M</li>
<li>claude-opus-5 pooled ratio 2.5x — no published USD rate</li>
<li>gpt-5.6-sol pooled ratio 1.8x — no published USD rate</li>
</ul>`,
  );
}

// ---------------------------------------------------------------- relaygpu
// Model name lives in a ModelTable_modelName element; two prices in a cell
// mean a standard route and an OpenGPU route.
{
  const rows = [
    ['Qwen3.5-35B', '$0.10 $0.08', '$0.60 $0.48', '$0.02 $0.016'],
    ['Claude Opus 5', '$1.20', '$6.00', '$0.12'],
    // No prices at all: must be skipped.
    ['Embedding Model', '—', '—', '—'],
  ];
  write(
    'relaygpu-pricing.html',
    `${banner('RelayGPU')}
<table>
<thead>${head(['Model', 'Input', 'Output', 'Cache read'])}</thead>
<tbody>
${rows
  .map(
    ([name, i, o, cr]) =>
      `<tr><td><span class="ModelTable_modelName">${name}</span></td><td>${i}</td><td>${o}</td><td>${cr}</td></tr>`,
  )
  .join('\n')}
</tbody>
</table>`,
  );
}

// ------------------------------------------------------------------ zrelay
// Requires the entry credit tier marker, then a per-model debit table.
{
  const rows = [
    ['claude-opus-5', '$5 / M', '$25 / M'],
    ['gpt-5.6-sol', '$5 / M', '$30 / M'],
    // Non-comparable products, skipped by the model-id filter.
    ['gpt-image-2', '$40 / M', '$40 / M'],
    ['gemini-3.1-pro', '$1 / M', '$6 / M'],
  ];
  write(
    'zrelay-pricing.html',
    `${banner('Zrelay')}
<p>Starter · trial — pay $16, receive $100 credit</p>
<table>
<thead>${head(['Model', 'Input', 'Output'])}</thead>
<tbody>
${rows.map((cells) => row(cells)).join('\n')}
</tbody>
</table>`,
  );
}

// ---------------------------------------------------------------- midrelay
// Model | provider pair | official pair | notes
{
  const rows = [
    ['Claude Opus 5', '$1.59 / $7.94', '$5 / $25'],
    ['GPT-5.6 Sol', '$0.62 / $3.71', '$5 / $30'],
  ];
  write(
    'midrelay-pricing.html',
    `${banner('MidRelay')}
<table>
<tbody>
${row(['Model', 'Price', 'Official', 'Save'])}
${rows.map(([name, price, official]) => row([name, price, official, '−68%'])).join('\n')}
</tbody>
</table>`,
  );
}

// ------------------------------------------------------------ llmrelay-dev
// Flat grid rows: model link, then input, output and official input prices.
{
  const rows = [
    ['claude-opus-5', '2.5', '12.5', '5'],
    ['gpt-5.6-sol', '2.5', '15', '5'],
    // Image product: rejected by the text-model filter.
    ['gpt-image-2', '0.04', '0.04', '0.08'],
  ];
  write(
    'llmrelay-dev-pricing.html',
    `${banner('llmrelay')}
${rows
  .map(
    ([id, i, o, ref]) =>
      `<div class="grid grid-cols-5">
  <a href="/models/${id}">${id}</a>
  <span>$${i}</span><span>$${o}</span><span>$${ref}</span><span>−50%</span>
</div>`,
  )
  .join('\n')}`,
  );
}
