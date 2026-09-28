(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const FIELDS = ['energy_kcal','sugar_g','added_sugar_g','fat_g','sat_fat_g','trans_fat_g','sodium_mg','protein_g','fibre_g'];
  let files = [], summary = '';

  /* Optional: set this to a backend URL that accepts image(s) and returns the JSON described in README.md.
     Never put an API key in front-end code. */
  const LABEL_API_URL = '';

  $('claims').innerHTML = CLAIM_TYPES.map(([k, l]) =>
    `<label class="chip"><input type="checkbox" value="${k}"><span>${l}</span></label>`).join('');

  $('photo').addEventListener('change', e => {
    files = Array.from(e.target.files).slice(0, 3);
    $('thumbs').innerHTML = '';
    files.forEach(f => { const i = new Image(); i.src = URL.createObjectURL(f); i.alt = 'Label photo'; $('thumbs').appendChild(i); });
    $('read').disabled = !files.length;
    $('status').textContent = LABEL_API_URL ? '' : 'Photo reading needs a backend (see README). You can enter the numbers yourself.';
    if (files.length) $('form').classList.remove('hide');
  });

  $('manual').onclick = () => { $('form').classList.remove('hide'); $('form').scrollIntoView({ behavior: 'smooth' }); };

  $('read').onclick = async () => {
    if (!LABEL_API_URL) { $('status').textContent = 'No label-reading backend is set. Type the numbers from the pack instead.'; $('manual').click(); return; }
    $('read').disabled = true; $('status').textContent = 'Reading label...';
    try {
      const fd = new FormData(); files.forEach(f => fd.append('images', f));
      const res = await fetch(LABEL_API_URL, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(res.status);
      fill(await res.json()); $('status').textContent = 'Check the numbers below, then press Check this pack.';
    } catch (e) { $('status').textContent = 'Could not read the label. Enter the numbers by hand.'; }
    finally { $('read').disabled = false; }
  };

  function fill(d) {
    $('name').value = [d.brand, d.product].filter(Boolean).join(' ');
    FIELDS.forEach(k => { $(k).value = d.per100g?.[k] ?? ''; });
    $('ingredients').value = (d.ingredients || []).join(', ');
    (d.claims || []).forEach(c => { const el = document.querySelector(`#claims input[value="${c.type}"]`); if (el) el.checked = true; });
    $('form').classList.remove('hide');
  }

  function read() {
    const per100 = {};
    FIELDS.forEach(k => { const v = parseFloat($(k).value); per100[k] = isNaN(v) ? null : v; });
    return {
      product: $('name').value.trim(), type: $('type').value, per100,
      ingredients: $('ingredients').value.split(',').map(s => s.trim()).filter(Boolean),
      claims: Array.from(document.querySelectorAll('#claims input:checked')).map(i => i.value)
    };
  }

  $('check').onclick = () => {
    const d = read(), { score, flags } = evaluate(d);
    const col = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--mustard)' : 'var(--bad)';
    $('scoreNum').textContent = score;
    $('ring').style.background = `conic-gradient(${col} ${score * 3.6}deg, rgba(128,128,128,.25) 0)`;
    $('verdict').textContent = verdict(score); $('verdict').style.color = col;
    $('prod').textContent = d.product || 'Unnamed product';
    $('claimRows').innerHTML = d.claims.length
      ? d.claims.map(t => { const [k, m] = checkClaim(t, d); const label = CLAIM_TYPES.find(c => c[0] === t)[1];
          return `<div class="row ${k}"><b>${esc(label)}</b>${esc(m)}</div>`; }).join('')
      : '<p class="note">No claims selected.</p>';
    $('flagRows').innerHTML = flags.length ? flags.map(f => `<div class="flag">\u2022 ${esc(f)}</div>`).join('') : '<p class="note">No major red flags found.</p>';
    summary = `${d.product || 'Product'}: ${score}/100 (${verdict(score)})` + (flags.length ? '\n' + flags.join('\n') : '');
    $('result').classList.remove('hide'); $('result').scrollIntoView({ behavior: 'smooth' });
  };

  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(summary); $('copy').textContent = 'Copied'; }
    catch (e) { $('copy').textContent = 'Copy failed'; }
  };
})();
