var MON_DATA = [
];
var MON_MONTHS = [];
var MON_DATE_TO_IDX = {};
var MON_YEAR_RANGE = {};
var MON_REGIONS = [];
var MON_REGION_MAP = {'방이':'송파'};
var MON_META = {total_posts:0,updated:'2026.11.04 09:36'};

var monRegion = '전체', monDate = '전체', monOpenId = null;
var monSearchQuery = '', monOnlyUs = false, monSortBy = 'mentions';

var MON_CONS_ONLY_TAGS = {
  '숙제/학습량부담': true, '셔틀불만': true, '가격부담': true,
  '개별관리부족': true, '기타개선점': true, '강사교체/불만': true,
  '레벨테스트부담': true, '시설불만': true
};
var MON_PROS_ONLY_TAGS = {
  '합리적가격': true, '성적향상/성과': true, '반복/심화학습': true,
  '흥미/동기부여': true, '셔틀/접근성': true, '차량/접근성': true
};
var MON_TAG_NORMALIZE = {
  '차량/접근성': '셔틀/접근성'
};

// ─── SANITIZE & NORMALIZE EXISTING DATA ──────────────────────────────────────

function monCleanText(s) {
  if (!s) return '';
  return String(s)
    .replace(/<\/?b>/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
}

function monSanitizeData() {
  if (typeof MON_DATA === 'undefined' || !Array.isArray(MON_DATA)) return;

  MON_DATA.forEach(function(ac) {
    var prosMap = {};
    var consMap = {};
    var urlMeta = {};

    function addPostToMap(map, label, post) {
      var normLabel = MON_TAG_NORMALIZE[label] || label;
      if (!map[normLabel]) map[normLabel] = [];
      var exists = map[normLabel].some(function(p) {
        return p.url && post.url && p.url === post.url && p.quote === post.quote;
      });
      if (!exists) map[normLabel].push(post);
    }

    (ac.pros || []).forEach(function(item) {
      var lbl = MON_TAG_NORMALIZE[item.label] || item.label;
      (item.posts || []).forEach(function(p) {
        p.text = monCleanText(p.text);
        p.quote = monCleanText(p.quote);
        if (p.url) urlMeta[p.url] = { region: p.region || '', date: p.date || '', text: p.text || '' };
        if (MON_CONS_ONLY_TAGS[lbl]) {
          addPostToMap(consMap, lbl, p);
        } else {
          addPostToMap(prosMap, lbl, p);
        }
      });
    });

    (ac.cons || []).forEach(function(item) {
      var lbl = MON_TAG_NORMALIZE[item.label] || item.label;
      (item.posts || []).forEach(function(p) {
        p.text = monCleanText(p.text);
        p.quote = monCleanText(p.quote);
        if (p.url) {
          if (!urlMeta[p.url]) urlMeta[p.url] = { region: p.region || '', date: p.date || '', text: p.text || '' };
        }
        if (MON_PROS_ONLY_TAGS[lbl]) {
          addPostToMap(prosMap, lbl, p);
        } else {
          addPostToMap(consMap, lbl, p);
        }
      });
    });

    ac.pros = Object.keys(prosMap).map(function(k) {
      return { label: k, count: prosMap[k].length, posts: prosMap[k] };
    }).sort(function(a, b) { return b.count - a.count; });

    ac.cons = Object.keys(consMap).map(function(k) {
      return { label: k, count: consMap[k].length, posts: consMap[k] };
    }).sort(function(a, b) { return b.count - a.count; });

    (ac.allPosts || []).forEach(function(p) {
      p.text = monCleanText(p.text);
      if (p.url && urlMeta[p.url]) {
        if (!p.region && urlMeta[p.url].region) p.region = urlMeta[p.url].region;
        if (!p.date && urlMeta[p.url].date) p.date = urlMeta[p.url].date;
        if (!p.text && urlMeta[p.url].text) p.text = urlMeta[p.url].text;
      }
    });
  });
}

// ─── PERIOD NAV ───────────────────────────────────────────────────────────────

function monGetYears() {
  return Object.keys(MON_YEAR_RANGE).sort().reverse();
}

function monGetMonthsForYear(yr) {
  var r = MON_YEAR_RANGE[yr];
  if (!r) return [];
  var allKeys = Object.keys(MON_DATE_TO_IDX);
  var months = [];
  for (var i = r[1]; i >= r[0]; i--) {
    for (var k = 0; k < allKeys.length; k++) {
      if (MON_DATE_TO_IDX[allKeys[k]] === i) { months.push(allKeys[k]); break; }
    }
  }
  return months;
}

function monBuildYearSelect() {
  var sel = document.getElementById('mon-year-select');
  if (!sel) return;
  var years = monGetYears();
  sel.innerHTML = years.map(function(yr) {
    return '<option value="' + yr + '">' + yr + '</option>';
  }).join('');
}

function monRenderMonthPills(yr, activeKey) {
  var pills = document.getElementById('mon-month-pills');
  if (!pills) return;
  var months = monGetMonthsForYear(yr);
  var html = '<button class="mon-month-btn' + (monDate === yr ? ' active' : '') + '" onclick="monSetYearTotal(\'' + yr + '\')">' + yr + ' 전체</button>';
  html += months.map(function(key) {
    var parts = key.split('.');
    var display = parseInt(parts[1], 10) + '월';
    return '<button class="mon-month-btn' + (key === activeKey ? ' active' : '') + '" onclick="monSetMonth(this,\'' + key + '\')">' + display + '</button>';
  }).join('');
  pills.innerHTML = html;
}

function monSetYearTotal(yr) {
  monDate = yr;
  var btnAll = document.querySelector('.mon-btn-all');
  if (btnAll) btnAll.classList.remove('active');
  monRenderMonthPills(yr, null);
  monOpenId = null;
  monRenderAll();
}

function monOnYearChange(yr) {
  var months = monGetMonthsForYear(yr);
  var btnAll = document.querySelector('.mon-btn-all');
  if (btnAll) btnAll.classList.remove('active');
  if (months.length) {
    monDate = months[0];
    monRenderMonthPills(yr, monDate);
  } else {
    monDate = yr;
    monRenderMonthPills(yr, null);
  }
  monOpenId = null;
  monRenderAll();
}

function monSetMonth(btn, key) {
  monDate = key;
  document.querySelectorAll('.mon-month-btn').forEach(function(b) { b.classList.remove('active'); });
  var btnAll = document.querySelector('.mon-btn-all');
  if (btnAll) btnAll.classList.remove('active');
  btn.classList.add('active');
  monOpenId = null;
  monRenderAll();
}

function monSetAll(btn) {
  monDate = '전체';
  document.querySelectorAll('.mon-month-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  monOpenId = null;
  monRenderAll();
}

// ─── REGION & FILTERS ─────────────────────────────────────────────────────────

function monSetRegion(el, val) {
  document.querySelectorAll('#mon-region-group .mon-pill').forEach(function(p) { p.classList.remove('active-region'); });
  el.classList.add('active-region');
  monRegion = val;
  monOpenId = null;
  monRenderAll();
}

function monOnSearchInput(val) {
  monSearchQuery = (val || '').trim().toLowerCase();
  var clearBtn = document.getElementById('mon-search-clear');
  if (clearBtn) clearBtn.style.display = monSearchQuery ? 'inline-flex' : 'none';
  monRenderTable();
}

function monClearSearch() {
  var inp = document.getElementById('mon-search-input');
  if (inp) inp.value = '';
  monOnSearchInput('');
}

function monToggleUsOnly(btn) {
  monOnlyUs = !monOnlyUs;
  if (btn) btn.classList.toggle('active', monOnlyUs);
  monOpenId = null;
  monRenderAll();
}

function monSetSort(val) {
  monSortBy = val || 'mentions';
  document.querySelectorAll('.mon-sort-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-sort') === monSortBy);
  });
  monRenderTable();
}

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────

function monGetCount(ac) {
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  var rm = (ac.mentions && ac.mentions[regionKey]) || (ac.mentions && ac.mentions['전체']);
  if (!rm) return 0;
  if (monDate === '전체') return rm['전체'] || 0;
  return rm[monDate] || 0;
}

function monGetPrevCount(ac) {
  if (monDate === '전체') return null;
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  var rm = (ac.mentions && ac.mentions[regionKey]) || (ac.mentions && ac.mentions['전체']);
  if (!rm) return null;
  var prevKey;
  if (monDate.indexOf('년') > -1) {
    var yr = parseInt(monDate, 10);
    prevKey = (yr - 1) + '년';
  } else {
    var parts = monDate.split('.');
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
    m--;
    if (m === 0) { m = 12; y--; }
    prevKey = y + '.' + (m < 10 ? '0' + m : '' + m);
  }
  return rm[prevKey] !== undefined ? rm[prevKey] : 0;
}

function monFormatDeltaHtml(cur, prev) {
  if (prev === null || prev === undefined) return '';
  var diff = cur - prev;
  if (prev === 0 && cur > 0) {
    return '<span class="mon-chg new" title="전기 0건 → 이번 기간 신규 언급">NEW</span>';
  }
  if (diff > 0) {
    return '<span class="mon-chg up" title="전기(' + prev + '건) 대비 +' + diff + '건 증가">▲' + diff + '</span>';
  }
  if (diff < 0) {
    return '<span class="mon-chg dn" title="전기(' + prev + '건) 대비 ' + diff + '건 감소">▼' + Math.abs(diff) + '</span>';
  }
  return '<span class="mon-chg eq" title="전기(' + prev + '건)와 동일">-</span>';
}

function monFilterList(items) {
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  if (!items) return [];
  return items.map(function(item) {
    var posts = (item.posts || []).filter(function(post) {
      if (monRegion !== '전체' && post.region !== regionKey) return false;
      if (monDate === '전체') return true;
      if (monDate.indexOf('년') > -1) {
        var yr = monDate.replace('년', '');
        return post.date && post.date.indexOf(yr + '.') === 0;
      }
      return post.date === monDate;
    });
    return { label: item.label, count: posts.length, posts: posts };
  }).filter(function(item) { return item.count > 0; });
}

function monMatchesSearch(ac, fp, fc) {
  if (!monSearchQuery) return true;
  if (ac.name.toLowerCase().indexOf(monSearchQuery) > -1) return true;
  var hit = false;
  fp.concat(fc).forEach(function(item) {
    if (item.label.toLowerCase().indexOf(monSearchQuery) > -1) hit = true;
    (item.posts || []).forEach(function(p) {
      if ((p.quote && p.quote.toLowerCase().indexOf(monSearchQuery) > -1) ||
          (p.text && p.text.toLowerCase().indexOf(monSearchQuery) > -1)) {
        hit = true;
      }
    });
  });
  return hit;
}

function monGetBaseFiltered() {
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  return MON_DATA.filter(function(ac) {
    if (monOnlyUs && !ac.us) return false;
    if (monRegion !== '전체') {
      var rm = ac.mentions && ac.mentions[regionKey];
      if (!rm || (rm['전체'] || 0) === 0) return false;
    }
    return monGetCount(ac) > 0;
  });
}

function monGetFiltered() {
  var base = monGetBaseFiltered();
  var filtered = base.filter(function(ac) {
    var fp = monFilterList(ac.pros);
    var fc = monFilterList(ac.cons);
    if (!monMatchesSearch(ac, fp, fc)) return false;
    return true;
  });

  return filtered.slice().sort(function(a, b) {
    if (monSortBy === 'pros') {
      var pa = monFilterList(a.pros).reduce(function(s, x) { return s + x.count; }, 0);
      var pb = monFilterList(b.pros).reduce(function(s, x) { return s + x.count; }, 0);
      if (pb !== pa) return pb - pa;
    } else if (monSortBy === 'cons') {
      var ca = monFilterList(a.cons).reduce(function(s, x) { return s + x.count; }, 0);
      var cb = monFilterList(b.cons).reduce(function(s, x) { return s + x.count; }, 0);
      if (cb !== ca) return cb - ca;
    } else if (monSortBy === 'delta') {
      var da = monGetCount(a) - (monGetPrevCount(a) || 0);
      var db = monGetCount(b) - (monGetPrevCount(b) || 0);
      if (db !== da) return db - da;
    }
    return monGetCount(b) - monGetCount(a);
  });
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function monRenderAll() {
  var titleEl = document.getElementById('mon-title');
  if (titleEl) titleEl.textContent = '경쟁학원 온라인 모니터링';

  var subtitleEl = document.getElementById('mon-subtitle');
  if (subtitleEl && typeof MON_META !== 'undefined' && MON_META.updated) {
    var periodLabel = monDate === '전체' ? '전체 기간' : monDate;
    var regionLabel = monRegion === '전체' ? '전 지역' : monRegion;
    subtitleEl.innerHTML = '<span>최종 업데이트 ' + MON_META.updated + '</span>' +
      '<span class="mon-sub-sep">·</span>' +
      '<span class="mon-sub-active">조회 기준: ' + regionLabel + ' / ' + periodLabel + '</span>';
  }

  monRenderHighlights();
  monRenderTable();
}

function monRenderHighlights() {
  var el = document.getElementById('mon-highlights');
  if (!el) return;
  var list = monGetBaseFiltered();
  if (!list.length) { el.innerHTML = ''; return; }

  var sortedByMentions = list.slice().sort(function(a, b) { return monGetCount(b) - monGetCount(a); });
  var top = sortedByMentions[0];
  var topCur = monGetCount(top);
  var topPrev = monGetPrevCount(top);
  var filteredPosts = list.reduce(function(sum, ac) { return sum + monGetCount(ac); }, 0);

  var posTotal = 0, negTotal = 0;
  var tagCounts = {};
  list.forEach(function(ac) {
    monFilterList(ac.pros).forEach(function(item) {
      posTotal += item.count;
      tagCounts[item.label] = (tagCounts[item.label] || 0) + item.count;
    });
    monFilterList(ac.cons).forEach(function(item) {
      negTotal += item.count;
      tagCounts[item.label] = (tagCounts[item.label] || 0) + item.count;
    });
  });

  var tagEntries = Object.keys(tagCounts).map(function(k) { return [k, tagCounts[k]]; });
  tagEntries.sort(function(a, b) { return b[1] - a[1]; });
  var topTag = tagEntries[0];

  var evalTotal = posTotal + negTotal;
  var posPct = evalTotal > 0 ? Math.round((posTotal / evalTotal) * 100) : 0;

  var html = '<div class="mon-highlights-grid">';
  html += '<div class="mon-hl-card featured">' +
    '<div class="mon-hl-label">모니터링 현황</div>' +
    '<div class="mon-hl-value">' + list.length + '개 학원</div>' +
    '<div class="mon-hl-sub">총 <strong>' + filteredPosts + '건</strong> 언급 · 긍정 <strong>' + posPct + '%</strong></div>' +
    '</div>';

  html += '<div class="mon-hl-card">' +
    '<div class="mon-hl-label">최다 언급 학원</div>' +
    '<div class="mon-hl-value">' + top.name + '</div>' +
    '<div class="mon-hl-sub"><strong>' + topCur + '건</strong> 언급 ' + monFormatDeltaHtml(topCur, topPrev) + '</div>' +
    '</div>';

  if (topTag) {
    html += '<div class="mon-hl-card">' +
      '<div class="mon-hl-label">가장 활발한 평가 주제</div>' +
      '<div class="mon-hl-value">' + topTag[0] + '</div>' +
      '<div class="mon-hl-sub">장단점 합산 <strong>' + topTag[1] + '건</strong> 언급</div>' +
      '</div>';
  } else {
    html += '<div class="mon-hl-card">' +
      '<div class="mon-hl-label">가장 활발한 평가 주제</div>' +
      '<div class="mon-hl-value">—</div>' +
      '<div class="mon-hl-sub">해당 기간 분류된 평가 없음</div>' +
      '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

function monSentimentBarHtml(prosSum, consSum) {
  var total = prosSum + consSum;
  if (total === 0) {
    return '<div class="mon-sbar-empty">평가 없음</div>';
  }
  var posPct = Math.round((prosSum / total) * 100);
  var negPct = 100 - posPct;
  return '<div class="mon-sbar-wrap" title="긍정 ' + prosSum + '건 (' + posPct + '%) / 부정 ' + consSum + '건 (' + negPct + '%)">' +
    '<div class="mon-sbar">' +
      (prosSum > 0 ? '<div class="mon-sbar-pos" style="width:' + posPct + '%"></div>' : '') +
      (consSum > 0 ? '<div class="mon-sbar-neg" style="width:' + negPct + '%"></div>' : '') +
    '</div>' +
    '<div class="mon-sbar-nums">' +
      '<span class="mon-pros-num">+' + prosSum + '</span>' +
      '<span class="mon-sbar-slash">/</span>' +
      '<span class="mon-cons-num">-' + consSum + '</span>' +
    '</div>' +
  '</div>';
}

function monTopTagsPreviewHtml(fp, fc) {
  var badges = [];
  fp.slice(0, 2).forEach(function(it) {
    badges.push('<span class="mon-mini-tag pos">' + it.label + ' <b>' + it.count + '</b></span>');
  });
  fc.slice(0, 1).forEach(function(it) {
    badges.push('<span class="mon-mini-tag neg">' + it.label + ' <b>' + it.count + '</b></span>');
  });
  if (!badges.length) return '';
  return '<div class="mon-ac-tags">' + badges.join('') + '</div>';
}

function monRenderTable() {
  var list = monGetFiltered();
  var tbody = document.getElementById('mon-tbody');
  if (!tbody) return;

  var countEl = document.getElementById('mon-list-count');
  if (countEl) countEl.textContent = list.length + '개 학원';

  var prevOpenId = monOpenId;
  monOpenId = null;
  tbody.innerHTML = '';

  if (!list.length) {
    var emptyTr = document.createElement('tr');
    emptyTr.innerHTML = '<td colspan="7" class="mon-empty-td">조건에 맞는 학원 데이터가 없습니다. 검색어나 필터를 변경해 보세요.</td>';
    tbody.appendChild(emptyTr);
    return;
  }

  list.forEach(function(ac, i) {
    var rank = i + 1;
    var cur = monGetCount(ac);
    var prev = monGetPrevCount(ac);
    var fp = monFilterList(ac.pros);
    var fc = monFilterList(ac.cons);
    var prosSum = fp.reduce(function(s, p) { return s + p.count; }, 0);
    var consSum = fc.reduce(function(s, c) { return s + c.count; }, 0);
    var globalIdx = MON_DATA.indexOf(ac);
    var id = 'ac-' + globalIdx;

    var tr = document.createElement('tr');
    tr.className = 'mon-ac-row' + (ac.us ? ' is-us-row' : '');
    tr.id = id;
    tr.innerHTML =
      '<td class="mon-c"><div class="mon-rank' + (rank === 1 ? ' top1' : rank <= 3 ? ' top3' : '') + '">' + rank + '</div></td>' +
      '<td>' +
        '<div class="mon-ac-name-wrap">' +
          '<div class="mon-ac-name">' + ac.name + (ac.us ? ' <span class="mon-badge-us">자사</span>' : '') + '</div>' +
          monTopTagsPreviewHtml(fp, fc) +
        '</div>' +
      '</td>' +
      '<td class="mon-r">' +
        '<div class="mon-mention-cell">' +
          '<span class="mon-mention-val">' + cur + '<span class="mon-unit">건</span></span>' +
          monFormatDeltaHtml(cur, prev) +
        '</div>' +
      '</td>' +
      '<td class="mon-c">' + (prosSum > 0 ? '<span class="mon-pros-num">' + prosSum + '</span>' : '<span class="mon-na">—</span>') + '</td>' +
      '<td class="mon-c">' + (consSum > 0 ? '<span class="mon-cons-num">' + consSum + '</span>' : '<span class="mon-na">—</span>') + '</td>' +
      '<td class="mon-c mon-hide-mobile">' + monSentimentBarHtml(prosSum, consSum) + '</td>' +
      '<td class="mon-c"><span class="mon-chevron">▾</span></td>';

    (function(rowId) {
      tr.onclick = function() { monToggleRow(rowId); };
    })(id);
    tbody.appendChild(tr);

    var dt = document.createElement('tr');
    dt.className = 'mon-detail-row';
    dt.id = 'dt-' + id;
    var td = document.createElement('td');
    td.colSpan = 7;
    td.innerHTML = monDetailHtml(ac, fp, fc, prosSum, consSum, cur, prev);
    dt.appendChild(td);
    tbody.appendChild(dt);

    if (prevOpenId === id) {
      tr.classList.add('open');
      dt.classList.add('open');
      monOpenId = id;
    }
  });
}

function monToggleRow(id) {
  if (monOpenId && monOpenId !== id) {
    var oldTr = document.getElementById(monOpenId);
    var oldDt = document.getElementById('dt-' + monOpenId);
    if (oldTr) oldTr.classList.remove('open');
    if (oldDt) oldDt.classList.remove('open');
  }
  var tr = document.getElementById(id);
  var dt = document.getElementById('dt-' + id);
  if (!tr || !dt) return;
  if (monOpenId === id) {
    tr.classList.remove('open');
    dt.classList.remove('open');
    monOpenId = null;
  } else {
    tr.classList.add('open');
    dt.classList.add('open');
    monOpenId = id;
    dt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ─── SPARKLINE & DETAIL PANEL ────────────────────────────────────────────────

function monSparklineHtml(ac) {
  if (typeof MON_MONTHS === 'undefined' || !ac.monthly) return '';
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  var arr = (ac.monthly && ac.monthly[regionKey]) || (ac.monthly && ac.monthly['전체']);
  if (!arr || !arr.length) return '';

  // 최근 12개월 (또는 전체가 12개 이하면 전체)
  var len = arr.length;
  var startIdx = Math.max(0, len - 12);
  var slice = arr.slice(startIdx);
  var labels = MON_MONTHS.slice(startIdx);
  var maxVal = Math.max.apply(null, slice.concat([1]));

  var activeIdx = (monDate && MON_DATE_TO_IDX && MON_DATE_TO_IDX[monDate] !== undefined)
    ? (MON_DATE_TO_IDX[monDate] - startIdx)
    : -1;

  var bars = slice.map(function(v, i) {
    var h = v > 0 ? Math.max(16, Math.round((v / maxVal) * 100)) : 6;
    var isCur = i === activeIdx;
    return '<div class="mon-spark-col' + (isCur ? ' active' : '') + '" title="20' + labels[i] + '월: ' + v + '건">' +
      '<div class="mon-spark-val">' + (v > 0 ? v : '') + '</div>' +
      '<div class="mon-spark-bar-wrap"><div class="mon-spark-bar' + (v === 0 ? ' zero' : '') + '" style="height:' + h + '%"></div></div>' +
      '<div class="mon-spark-lbl">' + labels[i].split('.')[1] + '월</div>' +
    '</div>';
  }).join('');

  return '<div class="mon-dstat mon-dstat-chart">' +
    '<div class="mon-dstat-chart-hd">' +
      '<span class="mon-dstat-label-inline">월별 언급 추이 (최근 ' + slice.length + '개월)</span>' +
    '</div>' +
    '<div class="mon-sparkline">' + bars + '</div>' +
  '</div>';
}

function monEvalColHtml(items, type) {
  var isPos = type === 'pos';
  var title = isPos ? '👍 주요 장점 (긍정 평가)' : '👎 주요 단점 / 아쉬운 점';
  var html = '<div class="mon-eval-col"><div class="mon-eval-hd ' + (isPos ? 'pos' : 'neg') + '">' + title + '</div>';
  if (!items || !items.length) {
    html += '<div class="mon-eval-empty">선택한 기간/지역에 분류된 ' + (isPos ? '장점' : '단점') + ' 평가가 없습니다.</div>';
  } else {
    items.forEach(function(it) {
      html += '<div class="mon-eval-item">' +
        '<div class="mon-eval-item-name">' + it.label + ' <span class="mon-eval-item-cnt">' + it.count + '건</span></div>';
      it.posts.forEach(function(p) {
        var q = p.quote || p.text || '';
        if (q.length > 140) q = q.substring(0, 140) + '…';
        var metaBadges = [];
        if (p.region) metaBadges.push('<span class="mon-post-meta-badge reg">' + p.region + '</span>');
        if (p.date) metaBadges.push('<span class="mon-post-meta-badge dt">' + p.date + '</span>');
        var titleHint = (p.text && p.text !== p.quote) ? '<div class="mon-eval-post-title">📄 ' + p.text + '</div>' : '';

        html += '<div class="mon-eval-post' + (isPos ? ' pos' : ' neg') + '">' +
          '<div class="mon-eval-post-body">' +
            '<div class="mon-eval-quote">"' + q + '"</div>' +
            titleHint +
            (metaBadges.length ? '<div class="mon-eval-meta">' + metaBadges.join('') + '</div>' : '') +
          '</div>' +
          (p.url ? '<a class="mon-eval-link" href="' + p.url + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">원문 ↗</a>' : '') +
        '</div>';
      });
      html += '</div>';
    });
  }
  return html + '</div>';
}

function monRecentPostsHtml(ac, fp, fc) {
  var regionKey = (MON_REGION_MAP && MON_REGION_MAP[monRegion]) || monRegion;
  var seenUrls = {};
  var combined = [];

  function pushPost(p, badge) {
    if (!p || !p.url) return;
    if (seenUrls[p.url]) return;
    if (monRegion !== '전체' && p.region && p.region !== regionKey) return;
    if (monDate !== '전체' && p.date) {
      if (monDate.indexOf('년') > -1) {
        var yr = monDate.replace('년', '');
        if (p.date.indexOf(yr + '.') !== 0) return;
      } else if (p.date !== monDate) {
        return;
      }
    }
    seenUrls[p.url] = true;
    combined.push({
      text: p.text || p.quote || '네이버 카페 게시글 원문 보기',
      url: p.url,
      region: p.region || '',
      date: p.date || '',
      badge: badge || '언급'
    });
  }

  fp.forEach(function(it) {
    (it.posts || []).forEach(function(p) { pushPost(p, '장점 · ' + it.label); });
  });
  fc.forEach(function(it) {
    (it.posts || []).forEach(function(p) { pushPost(p, '단점 · ' + it.label); });
  });
  (ac.allPosts || []).forEach(function(p) {
    pushPost(p, '일반 언급');
  });

  if (!combined.length) return '';

  combined.sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });

  var rowsHtml = combined.slice(0, 10).map(function(p) {
    var isPos = p.badge.indexOf('장점') === 0;
    var isNeg = p.badge.indexOf('단점') === 0;
    var badgeCls = isPos ? 'pos' : isNeg ? 'neg' : 'neu';
    return '<a class="mon-rpost-item" href="' + p.url + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' +
      '<div class="mon-rpost-left">' +
        '<span class="mon-rpost-badge ' + badgeCls + '">' + p.badge + '</span>' +
        (p.region ? '<span class="mon-post-meta-badge reg">' + p.region + '</span>' : '') +
        (p.date ? '<span class="mon-post-meta-badge dt">' + p.date + '</span>' : '') +
        '<span class="mon-rpost-title">' + (p.text || '게시글 원문 확인하기') + '</span>' +
      '</div>' +
      '<span class="mon-rpost-link">카페 원문 ↗</span>' +
    '</a>';
  }).join('');

  return '<div class="mon-rposts-box">' +
    '<div class="mon-rposts-hd">💬 관련 카페 게시글 원문 모음 <span>(' + combined.length + '건 중 최근 ' + Math.min(10, combined.length) + '건)</span></div>' +
    '<div class="mon-rposts-list">' + rowsHtml + '</div>' +
  '</div>';
}

function monDetailHtml(ac, fp, fc, prosSum, consSum, cur, prev) {
  var totalEval = prosSum + consSum;
  var posPct = totalEval > 0 ? Math.round((prosSum / totalEval) * 100) + '%' : '—';
  var negPct = totalEval > 0 ? (100 - Math.round((prosSum / totalEval) * 100)) + '%' : '—';

  return '<div class="mon-detail-inner">' +
    '<div class="mon-dstats">' +
      '<div class="mon-dstat">' +
        '<div class="mon-dstat-val-row"><span class="mon-dstat-val">' + cur + '</span>' + monFormatDeltaHtml(cur, prev) + '</div>' +
        '<div class="mon-dstat-label">전체 언급<span class="mon-dstat-sub">게시물+댓글 합산</span></div>' +
      '</div>' +
      '<div class="mon-dstat">' +
        '<div class="mon-dstat-val-row"><span class="mon-dstat-val acc">' + (prosSum || '—') + '</span>' + (prosSum > 0 ? '<span class="mon-dstat-pct pos">' + posPct + '</span>' : '') + '</div>' +
        '<div class="mon-dstat-label">장점 평가<span class="mon-dstat-sub">긍정 언급 건수</span></div>' +
      '</div>' +
      '<div class="mon-dstat">' +
        '<div class="mon-dstat-val-row"><span class="mon-dstat-val neg">' + (consSum || '—') + '</span>' + (consSum > 0 ? '<span class="mon-dstat-pct neg">' + negPct + '</span>' : '') + '</div>' +
        '<div class="mon-dstat-label">단점 평가<span class="mon-dstat-sub">부정 언급 건수</span></div>' +
      '</div>' +
      monSparklineHtml(ac) +
    '</div>' +
    '<div class="mon-eval-grid">' + monEvalColHtml(fp, 'pos') + monEvalColHtml(fc, 'neg') + '</div>' +
    monRecentPostsHtml(ac, fp, fc) +
    '<div class="mon-detail-notice">* 네이버 지역 맘카페 게시글·댓글을 AI로 자동 분류한 결과이며, 질문·단순 언급 글은 하단 원문 모음에서 확인하실 수 있습니다.</div>' +
  '</div>';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

function monInit() {
  monSanitizeData();
  monBuildYearSelect();
  var years = monGetYears();
  if (years.length) {
    var latestYear = years[0];
    var months = monGetMonthsForYear(latestYear);
    var sel = document.getElementById('mon-year-select');
    if (sel) sel.value = latestYear;
    if (months.length) {
      monDate = months[0];
      monRenderMonthPills(latestYear, monDate);
    } else {
      monRenderMonthPills(latestYear, null);
    }
  }
  monRenderAll();
}
