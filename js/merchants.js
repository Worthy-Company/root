// Merchants: who a charge, a statement or a payment was from. A merchant is an id and a name for now.
// Anything recorded points at it by merchantId and never copies the name, so renaming or merging a
// merchant later changes every record at once. Shared by every page that says who something was from
// (the credit card page, the medical statement page); needs ghReadFile/ghWriteFile (js/github.js) and
// shortId, escapeHtml (js/format.js).
//
// What the person sees is their word for it: a medical page calls a merchant a "provider" ("New
// provider: ..."), a card page calls it a "merchant". The word is a setting of the picker, not a
// second kind of thing.

const MERCHANTS_FILE = 'merchants.json';
const MERCHANTS_SCHEMA = 'personal-financial-data/merchants/v1';

async function readMerchants(token, repo, branch) {
  const file = await ghReadFile(token, repo, MERCHANTS_FILE, branch);
  return file ? (file.content.merchants || []) : [];
}

async function pushMerchants(token, repo, branch, merchants) {
  const existing = await ghReadFile(token, repo, MERCHANTS_FILE, branch);
  const content = { ...(existing?.content || { schema: MERCHANTS_SCHEMA }), merchants, updatedAt: new Date().toISOString() };
  await ghWriteFile(token, repo, MERCHANTS_FILE, content, branch, existing?.sha, GH_MSG('Update merchants'));
}

// A merchant can carry categories (ids from the starting list in finance/merchant-categories.json, for
// example 'healthcare' and 'insurance'). A page that knows what kind of merchant it is asking for names
// its category, and choosing a merchant there adds the category, so the next time it is offered first.
// Nothing is guessed or worked out: the category is only ever set by use.

// The typed name is an existing merchant or it makes a new one (the form has already said "New ...").
// Matched without regard to case. `isNew` says the merchant has to be added; `changed` says it has to be
// saved at all (it is new, or it just gained `category`). Save the merchant with mergeMerchant.
function merchantForName(merchants, name, category) {
  const known = merchants.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (known) {
    const has = (known.categories || []).includes(category);
    if (!category || has) return { merchant: known, isNew: false, changed: false };
    return { merchant: { ...known, categories: [...(known.categories || []), category] }, isNew: false, changed: true };
  }
  const merchant = { id: shortId(merchants.map(m => m.id)), name, ...(category ? { categories: [category] } : {}) };
  return { merchant, isNew: true, changed: true };
}

// The merchants with this one added, or replacing the one with its id.
function mergeMerchant(merchants, merchant) {
  return merchants.some(m => m.id === merchant.id)
    ? merchants.map(m => (m.id === merchant.id ? merchant : m))
    : [...merchants, merchant];
}

// The names to offer as someone types: every merchant, plus any other names given (older lines that
// have a name but no merchant yet), once each and in order.
function merchantNames(merchants, otherNames = []) {
  const seen = new Set();
  return [...merchants.map(m => m.name), ...otherNames]
    .filter(n => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
    .sort();
}

// Predict, then confirm: offer the names already known as one is typed, in a visible list (the
// browser's native autocomplete can't be seen or found by its words), and say so when the name is new,
// so a merchant is never added by accident. Arrow keys move through the offers, Enter takes the one
// highlighted, Tab takes it too (or else the first offer that begins with what was typed) and moves on;
// if nothing begins with it, Tab leaves the name alone, so a new name stays new. The offers are not tab
// stops: Tab is for completing the name and moving on, not for walking the list.
//
// With a `category`, merchants in it are offered first, and merchants outside it only when none in it
// matches what was typed, under a quiet "Other merchants", so a business with a similar name is still
// reachable and never gets copied by mistake.
//
//   const picker = wireMerchantPicker({ inputEl, offersEl, noteEl, noun: 'provider', category: 'healthcare', onChange });
//   picker.setMerchants(merchants);              // once the merchants are read (or setNames(list) for no category)
//   picker.refresh();                            // after the input's value is set from code
function wireMerchantPicker({ inputEl, offersEl, noteEl, noun = 'merchant', category = null, onChange = () => {} }) {
  let preferred = [];
  let others = [];
  let highlighted = -1;
  const optionEls = () => [...offersEl.querySelectorAll('button[role="option"]')];

  function highlight(index) {
    const options = optionEls();
    highlighted = Math.min(index, options.length - 1);
    options.forEach((el, i) => {
      el.classList.toggle('active', i === highlighted);
      el.setAttribute('aria-selected', i === highlighted ? 'true' : 'false');
    });
  }

  function refresh() {
    const typed = inputEl.value.trim().toLowerCase();
    const matching = (list) => (typed ? list.filter(n => n.toLowerCase().includes(typed)) : []);
    const exact = [...preferred, ...others].some(n => n.toLowerCase() === typed);
    const inCategory = matching(preferred);
    // Merchants outside the category are offered only when none in it matches, with a label.
    const shown = inCategory.length ? inCategory : matching(others);
    const label = !inCategory.length && shown.length ? '<div class="offers-label">Other merchants</div>' : '';
    offersEl.innerHTML = exact ? '' : label + shown.map(n => `<button type="button" role="option" tabindex="-1">${escapeHtml(n)}</button>`).join('');
    noteEl.textContent = typed && !exact ? `New ${noun}: ${inputEl.value.trim()}` : '';
    highlight(-1);
  }

  function pick(name) {
    inputEl.value = name;
    refresh();
    onChange();
  }

  inputEl.addEventListener('input', () => { refresh(); onChange(); });
  offersEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[role="option"]');
    if (btn) pick(btn.textContent);
  });
  inputEl.addEventListener('keydown', (ev) => {
    const options = optionEls();
    if (ev.key === 'ArrowDown' && options.length) {
      ev.preventDefault();
      highlight(highlighted + 1);
    } else if (ev.key === 'ArrowUp' && options.length) {
      ev.preventDefault();
      highlight(Math.max(highlighted - 1, 0));
    } else if (ev.key === 'Enter' && highlighted >= 0) {
      ev.preventDefault();
      pick(options[highlighted].textContent);
    } else if (ev.key === 'Tab' && !ev.shiftKey && options.length) {
      const typed = inputEl.value.trim().toLowerCase();
      const choice = highlighted >= 0 ? options[highlighted]
        : options.find(el => el.textContent.toLowerCase().startsWith(typed));
      if (choice) pick(choice.textContent);
    }
  });

  return {
    // Every name is offered alike (no category).
    setNames(list) { preferred = list; others = []; },
    // Merchants in this picker's category first, the rest as "Other merchants". `otherNames` are names
    // with no merchant yet (older lines), offered with the rest.
    setMerchants(merchants, otherNames = []) {
      const inCategory = merchants.filter(m => !category || (m.categories || []).includes(category));
      preferred = merchantNames(inCategory);
      const have = new Set(preferred.map(n => n.toLowerCase()));
      others = merchantNames(merchants.filter(m => !inCategory.includes(m)), otherNames).filter(n => !have.has(n.toLowerCase()));
    },
    // Offer these names now, whatever is typed (for example the names used before with a code that has
    // just been typed). Typing in the box goes back to offering matches.
    offerNames(list) {
      offersEl.innerHTML = list.map(n => `<button type="button" role="option" tabindex="-1">${escapeHtml(n)}</button>`).join('');
      highlight(-1);
    },
    refresh
  };
}
