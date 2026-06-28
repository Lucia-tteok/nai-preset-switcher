/* ===== NAI切换助手 · 更新中心模块 v3 =====
   功能：面板标题旁显示版本号 + i 按钮，点 i 弹出更新中心弹窗，
   弹窗内检查是否最新、显示更新内容、可选更新。不会自动检测。 */
(function() {
    "use strict";
    var LOCAL_VERSION = "1.4.3";
    var EXT_NAME = "/nai-preset-switcher"; // 扩展文件夹名，服务端会补全为 third-party/<name>
    var PANEL_ID = "nai-lib-panel-v2";
    var BAR_ID = "nai-update-bar";
    var MODAL_ID = "nai-update-modal";
    var MANIFEST_URLS = [
        "https://raw.githubusercontent.com/Lucia-tteok/nai-preset-switcher/main/manifest.json",
        "https://cdn.jsdelivr.net/gh/Lucia-tteok/nai-preset-switcher@main/manifest.json"
    ];

    function W() {
        try {
            return window.parent || window;
        } catch (e) {
            return window;
        }
    }

    function D() {
        try {
            if (window.parent && window.parent.document) return window.parent.document;
        } catch (e) {}
        return document;
    }

    function getOrigin() {
        try {
            if (W().location && W().location.origin) return W().location.origin;
        } catch (e) {}
        try {
            return location.origin;
        } catch (e) {}
        return "";
    }

    function getHeaders() {
        var w = W();
        try {
            if (typeof w.getRequestHeaders === "function") return w.getRequestHeaders();
        } catch (e) {}
        try {
            var ctx = w.SillyTavern && w.SillyTavern.getContext && w.SillyTavern.getContext();
            if (ctx && typeof ctx.getRequestHeaders === "function") return ctx.getRequestHeaders();
        } catch (e) {}
        return {
            "Content-Type": "application/json"
        };
    }

    function toast(type, msg, title) {
        var w = W();
        try {
            if (w.toastr && typeof w.toastr[type] === "function") {
                w.toastr[type](msg, title || "");
                return;
            }
        } catch (e) {}
        console.log("[NAI切换助手] " + (title ? title + ": " : "") + msg);
    }

    function apiBody() {
        return JSON.stringify({
            extensionName: EXT_NAME,
            global: false
        });
    }

    async function fetchRemoteManifest() {
        for (var i = 0; i < MANIFEST_URLS.length; i++) {
            try {
                var res = await fetch(MANIFEST_URLS[i] + "?_=" + Date.now(), {
                    cache: "no-store"
                });
                if (res && res.ok) return await res.json();
            } catch (e) {}
        }
        return null;
    }
    function compareVersion(a, b) {
        var pa = String(a || "").split(".").map(function(v) {
                return parseInt(v, 10) || 0
            }),
            pb = String(b || "").split(".").map(function(v) {
                return parseInt(v, 10) || 0
            }),
            len = Math.max(pa.length, pb.length);
        for (var i = 0; i < len; i++) {
            var da = pa[i] || 0,
                db = pb[i] || 0;
            if (da > db) return 1;
            if (da < db) return -1
        }
        return 0
    }
    function isRemoteNewer(remoteVersion) {
        return !!remoteVersion && compareVersion(remoteVersion, LOCAL_VERSION) > 0
    }
    async function checkUpdate() {
        var result = {
            isUpToDate: null,
            remoteVersion: "",
            changelog: ""
        };
        var origin = getOrigin();
        if (origin) {
            try {
                var res = await fetch(origin + "/api/extensions/version", {
                    method: "POST",
                    headers: getHeaders(),
                    body: apiBody(),
                    credentials: "include"
                });
                if (res && res.ok) {
                    var d = await res.json();
                    if (d && typeof d.isUpToDate !== "undefined") result.isUpToDate = d.isUpToDate;
                }
            } catch (e) {}
        }
        var mani = await fetchRemoteManifest();
        if (mani) {
            result.remoteVersion = mani.version || "";
            result.changelog = mani.changelog || "";
        }
        return result;
    }

    async function doUpdate(btn) {
        var origin = getOrigin();
        if (!origin) {
            toast("error", "无法获取酒馆地址，请用酒馆扩展面板手动更新。", "NAI切换助手");
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.textContent = "更新中…";
        }
        try {
            var res = await fetch(origin + "/api/extensions/update", {
                method: "POST",
                headers: getHeaders(),
                body: apiBody(),
                credentials: "include"
            });
            if (!res || !res.ok) {
                toast("error", "更新失败，请稍后重试或在酒馆扩展面板手动更新。", "NAI切换助手");
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "立即更新";
                }
                return;
            }
            var d = {};
            try {
                d = await res.json();
            } catch (e) {}
            if (d && d.isUpToDate) {
                toast("info", "已经是最新版本。", "NAI切换助手");
                if (btn) {
                    btn.textContent = "已是最新";
                }
            } else {
                toast("success", "更新完成" + (d && d.shortCommitHash ? "（" + d.shortCommitHash + "）" : "") + "，请刷新页面生效。", "NAI切换助手");
                if (btn) {
                    btn.textContent = "✅ 完成，请刷新页面";
                }
            }
        } catch (e) {
            toast("error", "更新请求异常，请检查网络。", "NAI切换助手");
            if (btn) {
                btn.disabled = false;
                btn.textContent = "立即更新";
            }
        }
    }

    function el(tag, css, text) {
        var d = D().createElement(tag);
        if (css) d.style.cssText = css;
        if (text != null) d.textContent = text;
        return d;
    }

    function closeModal() {
        var m = D().getElementById(MODAL_ID);
        if (m && m.parentNode) m.parentNode.removeChild(m);
    }

    /* === 点 i 后弹出的更新中心弹窗 === */
    async function openModal() {
        var doc = D();
        closeModal();

        // 遮罩
        var mask = el("div", "position:absolute;inset:0;z-index:999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;");
        mask.id = MODAL_ID;
        mask.addEventListener("click", function(ev) {
            if (ev.target === mask) {
                closeModal();
                var panel = doc.getElementById(PANEL_ID);
                if (panel) panel.style.display = "none";
            }
        });

        // 弹窗主体
        var box = el("div", "width:min(88vw,420px);max-height:78vh;overflow:auto;background:var(--SmartThemeBlurTintColor,#2b2b2b);color:var(--SmartThemeBodyColor,#eee);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:18px 20px;box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:14px;line-height:1.6;");

        // 头部：标题 + 关闭
        var head = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;");
        head.appendChild(el("div", "font-weight:700;font-size:16px;", "NAI切换助手 · 更新中心"));
        var closeBtn = el("div", "cursor:pointer;font-size:20px;opacity:.6;padding:2px 8px;border-radius:6px;", "✕");
        closeBtn.addEventListener("mouseenter", function() {
            closeBtn.style.opacity = "1";
            closeBtn.style.background = "rgba(255,255,255,.1)";
        });
        closeBtn.addEventListener("mouseleave", function() {
            closeBtn.style.opacity = ".6";
            closeBtn.style.background = "none";
        });
        closeBtn.addEventListener("click", closeModal);
        head.appendChild(closeBtn);
        box.appendChild(head);

        // 当前版本
        box.appendChild(el("div", "margin-bottom:6px;font-size:13px;opacity:.6;", "作者：毫无疑问你就是我的天使"));
        box.appendChild(el("div", "margin-bottom:14px;font-size:13px;opacity:.8;", "当前版本：v" + LOCAL_VERSION));

        // 状态区
        var status = el("div", "padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.06);margin-bottom:14px;", "正在检查更新…");
        box.appendChild(status);

        // 更新内容区（初始隐藏）
        var logWrap = el("div", "display:none;");
        var logTitle = el("div", "font-weight:600;margin-bottom:6px;font-size:13px;", "📢 更新日志");
        var logBox = el("div", "white-space:pre-wrap;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:13px;line-height:1.5;max-height:200px;overflow:auto;");
        logWrap.appendChild(logTitle);
        logWrap.appendChild(logBox);
        box.appendChild(logWrap);

        mask.appendChild(box);
        var panel = doc.getElementById(PANEL_ID);
        if (panel) panel.appendChild(mask);
        else doc.body.appendChild(mask);

        // 开始检查
        var info = await checkUpdate();

        // 显示更新日志
        if (info.changelog) {
            logWrap.style.display = "block";
            logBox.textContent = info.changelog;
        }

        // 显示检查结果
        var hasNewVersion = isRemoteNewer(info.remoteVersion);
        if (hasNewVersion) {
            status.textContent = "";
            status.style.background = "rgba(255,209,102,.10)";
            var line = el("div", "margin-bottom:10px;color:#ffd166;font-size:14px;", "🔔 发现新版本" + (info.remoteVersion ? " v" + info.remoteVersion : ""));
            status.appendChild(line);
            var btn = el("button", "padding:8px 20px;border:none;border-radius:8px;background:#4a90d9;color:#fff;cursor:pointer;font-size:14px;font-weight:500;transition:.15s;");
            btn.textContent = "立即更新";
            btn.addEventListener("mouseenter", function() {
                btn.style.background = "#3a7fc8";
            });
            btn.addEventListener("mouseleave", function() {
                btn.style.background = "#4a90d9";
            });
            btn.addEventListener("click", function() {
                doUpdate(btn);
            });
            status.appendChild(btn);
        } else if (info.remoteVersion || info.isUpToDate === true) {
            hideUpdateHint();
            status.textContent = "✅ 当前已是最新版本";
            status.style.background = "rgba(80,200,120,.12)";
        } else if (info.isUpToDate === false) {
            status.textContent = "";
            status.style.background = "rgba(255,209,102,.10)";
            var line2 = el("div", "margin-bottom:10px;color:#ffd166;font-size:14px;", "🔔 可能有可用更新");
            status.appendChild(line2);
            var hint = el("div", "font-size:12px;opacity:.7;margin-bottom:10px;", "未能获取远程版本号，建议在酒馆扩展面板手动检查更新，或点击下方按钮尝试更新。");
            status.appendChild(hint);
            var btn2 = el("button", "padding:8px 20px;border:none;border-radius:8px;background:#4a90d9;color:#fff;cursor:pointer;font-size:14px;font-weight:500;");
            btn2.textContent = "尝试更新";
            btn2.addEventListener("click", function() {
                doUpdate(btn2);
            });
            status.appendChild(btn2);
        } else {
            status.textContent = "无法自动检查更新（可能不是通过 Git URL 安装）。如需更新请用酒馆扩展面板。";
            status.style.opacity = ".7";
        }
    }

    /* === 面板标题重命名 + 插入版本标签（点击弹出更新中心） === */
    var _updateHint = null; // 更新提示元素引用
    function hideUpdateHint() {
        if (!_updateHint) return;
        _updateHint.textContent = "";
        _updateHint.style.display = "none";
    }
    function ensureBar() {
        var doc = D();
        var panel = doc.getElementById(PANEL_ID);
        if (!panel) return;

        // 把面板标题改成"NAI切换助手"
        var nlTitle = panel.querySelector(".nl-title");
        if (nlTitle && nlTitle.textContent.indexOf("NAI切换助手") !== -1) {
            nlTitle.textContent = "NAI切换助手";
        }

        // 已插入过则跳过
        if (doc.getElementById(BAR_ID)) return;

        var nlHead = panel.querySelector(".nl-head");
        if (!nlHead || !nlTitle) return;

        // 找到日夜切换按钮 ◐ (.nl-theme)，把它移到标题后面
        var themeBtn = nlHead.querySelector(".nl-theme");

        // 创建容器：[标题] [◐] [v版本] [更新提示]
        var bar = el("span", "display:inline-flex;align-items:center;gap:3px;margin-left:2px;vertical-align:middle;");
        bar.id = BAR_ID;

        // 如果找到了日夜切换按钮，把它移到这个容器里（从原位置移走）
        if (themeBtn) {
            themeBtn.style.marginLeft = "0";
            themeBtn.style.marginRight = "0";
            bar.appendChild(themeBtn);
        }

        // 版本标签（点击弹出更新中心）
        var tag = el("span", "padding:2px 9px;border-radius:6px;background:rgba(120,140,160,.15);font-size:11px;font-weight:600;color:inherit;white-space:nowrap;cursor:pointer;");
        tag.textContent = "v" + LOCAL_VERSION;
        tag.title = "点击打开更新中心";
        tag.addEventListener("mouseenter", function() {
            tag.style.background = "rgba(120,140,160,.3)";
        });
        tag.addEventListener("mouseleave", function() {
            tag.style.background = "rgba(120,140,160,.15)";
        });
        tag.addEventListener("click", function(ev) {
            ev.stopPropagation();
            openModal();
        });

        bar.appendChild(tag);

        // 更新提示文字（初始隐藏，检测到新版本后显示）
        var hint = el("span", "font-size:11px;color:inherit;white-space:nowrap;display:none;");
        _updateHint = hint;
        bar.appendChild(hint);

        // 插到标题后面
        nlTitle.parentNode.insertBefore(bar, nlTitle.nextSibling);

        // 面板首次加载时静默检测一次是否有更新
        silentCheckUpdate();
    }

    // 静默检测更新（不弹窗，只更新提示文字）
    var _silentChecked = false;
    async function silentCheckUpdate() {
        if (_silentChecked) return;
        _silentChecked = true;
        try {
            var mani = await fetchRemoteManifest();
            if (mani && isRemoteNewer(mani.version) && _updateHint) {
                _updateHint.textContent = "（点击版本号更新）";
                _updateHint.style.display = "inline";
            } else {
                hideUpdateHint();
            }
        } catch (e) {}
    }

    setInterval(function() {
        try {
            ensureBar();
        } catch (e) {}
    }, 1000);
})();
/* ===== 更新中心模块结束，以下为原有脚本 ===== */

!async function() {
    const e = "NAI切换助手",
        t = "nai-lib-style-v2",
        n = "nai-lib-menu-btn-v2",
        r = "nai-lib-panel-v2",
        a = "entries",
        i = "nai_lib_categories_v2",
        o = "nai_lib_deleted_chatu_v2",
        l = ["古风", "西幻", "现代", "科幻", "二次元", "写实", "未分类"],
        s = window.parent && window.parent.document || document;

    /* ===== NAI 持久化存储层 — extension_settings ===== */
    const NAI_SETTINGS_KEY = "nai_preset_switcher";
    var _naiSettingsReady = false;

    function _getNaiSettings() {
        try {
            var ctx = window.parent && window.parent.SillyTavern && window.parent.SillyTavern.getContext && window.parent.SillyTavern.getContext();
            if (ctx) {
                var ext = ctx.extensionSettings || (window.parent && window.parent.extension_settings);
                if (ext) {
                    if (!ext[NAI_SETTINGS_KEY] || typeof ext[NAI_SETTINGS_KEY] !== "object") {
                        ext[NAI_SETTINGS_KEY] = {};
                    }
                    return ext[NAI_SETTINGS_KEY];
                }
            }
        } catch (e) {}
        return null;
    }

    function _saveNaiSettings() {
        try {
            var ctx = window.parent && window.parent.SillyTavern && window.parent.SillyTavern.getContext && window.parent.SillyTavern.getContext();
            if (ctx && ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
        } catch (e) {}
    }

    function nlShowImagePreview(e, t) {
        if (!e) return;
        var n = s.getElementById(r);
        if (!n) return;
        var a = n.querySelector(".nl-img-preview");
        a && a.remove();
        a = s.createElement("div"), a.className = "nl-img-preview", a.setAttribute("style", "position:absolute;inset:0;z-index:10004;display:flex;align-items:center;justify-content:center;background:rgba(20,24,30,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:18px;"), a.innerHTML = '<div style="max-width:min(92vw,520px);max-height:82vh;display:flex;flex-direction:column;gap:10px;align-items:center;"><img src="' + e + '" style="max-width:100%;max-height:72vh;border-radius:14px;object-fit:contain;box-shadow:0 18px 60px rgba(0,0,0,.32);"><div style="color:#fff;font-size:13px;text-shadow:0 1px 4px rgba(0,0,0,.45);">' + k(t || "单击空白处关闭") + "</div></div>", a.addEventListener("click", function(e) {
            e.target === a && a.remove()
        }), n.querySelector(".nl-box").appendChild(a)
    }

    async function nlChangePresetThumb(e, t, n) {
        if (!e) return;
        var r = s.createElement("input");
        r.type = "file", r.accept = "image/*", r.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;", r.addEventListener("change", async function(a) {
            var i = a.target.files && a.target.files[0];
            try {
                if (i) {
                    var o = await C(i);
                    e.thumb = o, await I.put(e), E("预览图已更新", "success"), n && n(o), t && t.remove && t.remove()
                }
            } catch (e) {
                E("图片处理失败", "error")
            }
            r.remove()
        }), s.body.appendChild(r), r.click()
    }

    /* ===== 智绘姬参数组系统 ===== */
    var NL_DEFAULT_PARAM_GROUP = "\u9ed8\u8ba4";
    var NAI_PARAM_FIELDS = [{
        id: "novelaimode",
        label: "\u6a21\u578b",
        type: "select",
        options: ["nai-diffusion-3", "nai-diffusion-4-full", "nai-diffusion-4-curated-preview", "nai-diffusion-4-5-curated", "nai-diffusion-4-5-full"]
    }, {
        id: "novelai_sampler",
        label: "\u91c7\u6837\u65b9\u6cd5",
        type: "select",
        options: [{ v: "k_euler", t: "Euler" }, { v: "ddim_v3", t: "DDIM" }, { v: "k_dpmpp_2s_ancestral", t: "DPM++ 2S Ancestral" }, { v: "k_dpmpp_2m", t: "DPM++ 2M" }, { v: "k_euler_ancestral", t: "Euler Ancestral" }, { v: "k_dpmpp_2m_sde", t: "DPM++ 2M SDE" }, { v: "k_dpmpp_sde", t: "DPM++ SDE" }]
    }, {
        id: "Schedule",
        label: "\u566a\u70b9\u8868",
        type: "select",
        options: ["native", "exponential", "polyexponential", "karras"]
    }, {
        id: "novelai_size",
        label: "\u9884\u8bbe\u5c3a\u5bf8",
        type: "select",
        options: ["512x512", "640x640", "512x768", "768x512", "1024x1024", "1216x832", "832x1216"]
    }, {
        id: "nai3Scale",
        label: "Prompt Guidance",
        type: "number"
    }, {
        id: "cfg_rescale",
        label: "Prompt Guidance Rescale",
        type: "number"
    }, {
        id: "novelai_width",
        label: "\u5bbd\u5ea6 (width)",
        type: "number"
    }, {
        id: "novelai_height",
        label: "\u9ad8\u5ea6 (height)",
        type: "number"
    }, {
        id: "novelai_steps",
        label: "\u751f\u6210\u6b65\u6570 (steps)",
        type: "number"
    }, {
        id: "novelai_seed",
        label: "\u79cd\u5b50 (seed)",
        type: "number"
    }, {
        id: "AI_use_coords",
        label: "AI \u9ed8\u8ba4\u89d2\u8272\u4f4d\u7f6e",
        type: "checkbox"
    }, {
        id: "sm",
        label: "SMEA",
        type: "checkbox"
    }, {
        id: "dyn",
        label: "SMEA DYN",
        type: "checkbox"
    }, {
        id: "nai3Variety",
        label: "\u591a\u6837\u6027 (Variety)",
        type: "checkbox"
    }, {
        id: "nai3Deceisp",
        label: "\u51cf\u5c11\u4f2a\u5f71 (Decrisp)",
        type: "checkbox"
    }];

    var NL_NAI_PARAM_WRITING = !1;

    function nlNormalizeNaiSizeParams(params) {
        if (!params) return params;
        var m = String(params.novelai_size || "").match(/^(\d+)x(\d+)$/);
        return m && (params.novelai_width = m[1], params.novelai_height = m[2]), params
    }

    function nlReadAllNaiParams() {
        var doc = window.parent && window.parent.document || s,
            out = {};
        NAI_PARAM_FIELDS.forEach(function(f) {
            try {
                var el = doc.getElementById(f.id);
                if (!el) return;
                out[f.id] = "checkbox" === f.type ? !!el.checked : el.value;
            } catch (e) {}
        });
        return nlNormalizeNaiSizeParams(out)
    }

    function nlWriteAllNaiParams(params) {
        if (!params) return !1;
        params = nlNormalizeNaiSizeParams(params);
        var doc = window.parent && window.parent.document || s,
            jq = window.parent && (window.parent.jQuery || window.parent.$),
            wrote = !1;
        NL_NAI_PARAM_WRITING = !0;
        try {
            NAI_PARAM_FIELDS.forEach(function(f) {
                try {
                    if (!(f.id in params)) return;
                    var el = doc.getElementById(f.id);
                    if (!el) return;
                    if ("checkbox" === f.type) {
                        el.checked = !!params[f.id];
                        jq ? jq(el).prop("checked", !!params[f.id]).trigger("change") : el.dispatchEvent(new Event("change", { bubbles: !0 }))
                    } else {
                        el.value = params[f.id];
                        jq ? jq(el).val(params[f.id]).trigger("input").trigger("change") : (el.dispatchEvent(new Event("input", { bubbles: !0 })), el.dispatchEvent(new Event("change", { bubbles: !0 })))
                    }
                    wrote = !0
                } catch (e) {}
            })
        } finally {
            NL_NAI_PARAM_WRITING = !1
        }
        return wrote
    }

    function nlGetParamGroups() {
        var st = _getNaiSettings();
        if (!st) return {};
        return st.paramGroups && "object" == typeof st.paramGroups || (st.paramGroups = {}), st.paramGroups
    }

    function nlEnsureDefaultParamGroup() {
        var st = _getNaiSettings();
        if (!st) return;
        var groups = nlGetParamGroups();
        Object.keys(groups).length || (groups[NL_DEFAULT_PARAM_GROUP] = {
            params: nlReadAllNaiParams(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        }, st.defaultParamGroup = NL_DEFAULT_PARAM_GROUP, _saveNaiSettings())
    }

    function nlSaveParamGroup(name, params) {
        var st = _getNaiSettings();
        if (!st) return !1;
        var groups = nlGetParamGroups(),
            existing = groups[name];
        return groups[name] = {
            params: nlNormalizeNaiSizeParams(params || existing && existing.params || {}),
            createdAt: existing && existing.createdAt || Date.now(),
            updatedAt: Date.now()
        }, _saveNaiSettings(), !0
    }

    function nlCreateParamGroup(name) {
        if (!(name = (name || "").trim())) return !1;
        var groups = nlGetParamGroups();
        return !Object.prototype.hasOwnProperty.call(groups, name) && (nlSaveParamGroup(name, nlReadAllNaiParams()), !0)
    }

    function nlDeleteParamGroup(name) {
        if (name === NL_DEFAULT_PARAM_GROUP) return !1;
        var st = _getNaiSettings();
        if (!st) return !1;
        var groups = nlGetParamGroups();
        return !!groups[name] && (delete groups[name], st.activeParamGroup === name && (st.activeParamGroup = ""), _saveNaiSettings(), !0)
    }

    function nlRenameParamGroup(oldName, newName) {
        if (newName = (newName || "").trim(), oldName === NL_DEFAULT_PARAM_GROUP) return !1;
        if (!newName || newName === oldName) return !1;
        var st = _getNaiSettings();
        if (!st) return !1;
        var groups = nlGetParamGroups();
        return !(!groups[oldName] || groups[newName]) && (groups[newName] = groups[oldName], delete groups[oldName], groups[newName].updatedAt = Date.now(), st.activeParamGroup === oldName && (st.activeParamGroup = newName), _saveNaiSettings(), !0)
    }

    function nlApplyParamGroup(name) {
        var groups = nlGetParamGroups(),
            g = groups[name];
        if (!g) return !1;
        var st = _getNaiSettings();
        return st && (st.activeParamGroup = name, _saveNaiSettings()), nlWriteAllNaiParams(g.params)
    }

    function nlGetActiveParamGroup() {
        var st = _getNaiSettings(),
            groups = nlGetParamGroups();
        if (st && st.activeParamGroup && groups[st.activeParamGroup]) return st.activeParamGroup;
        if (groups[NL_DEFAULT_PARAM_GROUP]) return NL_DEFAULT_PARAM_GROUP;
        var keys = Object.keys(groups);
        return keys.length ? keys[0] : ""
    }

    function nlApplyPresetParams(n) {
        var groupName = n && n.naiParamGroup ? n.naiParamGroup : NL_DEFAULT_PARAM_GROUP;
        return groupName && nlGetParamGroups()[groupName] ? nlApplyParamGroup(groupName) : nlApplyChatuNaiParams(n)
    }

    function nlRenderParamFieldInputs(idPrefix, params) {
        params = params || {};
        return NAI_PARAM_FIELDS.map(function(f) {
            var val = f.id in params ? params[f.id] : "";
            if ("select" === f.type) {
                var optsHtml = f.options.map(function(o) {
                    var ov = void 0 !== o.v ? o.v : o,
                        ot = void 0 !== o.t ? o.t : o;
                    return '<option value="' + k(ov) + '"' + (String(val) === String(ov) ? " selected" : "") + ">" + k(ot) + "</option>"
                }).join("");
                return '<label style="font-size:12px;color:#566472;">' + k(f.label) + '<select class="nl-input" id="' + idPrefix + f.id + '" data-pf="' + k(f.id) + '" style="margin-top:4px;">' + optsHtml + "</select></label>"
            }
            if ("checkbox" === f.type) return '<label style="font-size:12px;color:#566472;display:flex;align-items:center;gap:6px;"><input type="checkbox" id="' + idPrefix + f.id + '" data-pf="' + k(f.id) + '"' + (val ? " checked" : "") + "> " + k(f.label) + "</label>";
            return '<label style="font-size:12px;color:#566472;">' + k(f.label) + '<input type="number" class="nl-input" id="' + idPrefix + f.id + '" data-pf="' + k(f.id) + '" value="' + k(void 0 === val ? "" : val) + '" style="margin-top:4px;"></label>'
        }).join("")
    }

    function nlReadParamFieldInputs(container, idPrefix) {
        var out = {};
        NAI_PARAM_FIELDS.forEach(function(f) {
            var el = container.querySelector("#" + idPrefix + f.id);
            el && (out[f.id] = "checkbox" === f.type ? !!el.checked : el.value)
        });
        return nlNormalizeNaiSizeParams(out)
    }

    function nlSyncParamSizeInputs(container, idPrefix) {
        if (!container) return;
        var sizeEl = container.querySelector("#" + idPrefix + "novelai_size"),
            widthEl = container.querySelector("#" + idPrefix + "novelai_width"),
            heightEl = container.querySelector("#" + idPrefix + "novelai_height"),
            m = sizeEl && String(sizeEl.value || "").match(/^(\d+)x(\d+)$/);
        m && (widthEl && (widthEl.value = m[1]), heightEl && (heightEl.value = m[2]))
    }

    function nlFillParamFieldInputs(container, idPrefix, params) {
        params = params || {};
        NAI_PARAM_FIELDS.forEach(function(f) {
            var el = container && container.querySelector("#" + idPrefix + f.id);
            el && f.id in params && ("checkbox" === f.type ? el.checked = !!params[f.id] : el.value = params[f.id])
        })
    }

    function nlRefreshVisibleParamInputs(groupName) {
        var panel = s.getElementById(r);
        if (!panel) return;
        var groups = nlGetParamGroups(), params = groupName && groups[groupName] && groups[groupName].params || nlReadAllNaiParams(), setFields = panel.querySelector("#nl-set-param-fields"), setSel = panel.querySelector("#nl-set-param-group"), detailFields = panel.querySelector("#nl-dparam-fields"), detailSel = panel.querySelector("#nl-dparam-group");
        setFields && setSel && (!groupName || setSel.value === groupName) && nlFillParamFieldInputs(setFields, "nl-set-pf-", params);
        detailFields && detailSel && (!groupName || detailSel.value === groupName) && nlFillParamFieldInputs(detailFields, "nl-dparam-pf-", params)
    }

    function nlBindChatuNaiParamReverseSync() {
        var doc = window.parent && window.parent.document || s;
        NAI_PARAM_FIELDS.forEach(function(f) {
            try {
                var el = doc.getElementById(f.id);
                if (!el || el._nlNaiParamReverseBound) return;
                el._nlNaiParamReverseBound = !0;
                ["input", "change"].forEach(function(ev) {
                    el.addEventListener(ev, function() {
                        if (NL_NAI_PARAM_WRITING) return;
                        var groupName = nlGetActiveParamGroup() || NL_DEFAULT_PARAM_GROUP, params = nlReadAllNaiParams();
                        nlSaveParamGroup(groupName, params);
                        nlRefreshVisibleParamInputs(groupName)
                    })
                })
            } catch (e) {}
        })
    }

    function nlGetFloatingEnabled() {
        var e = _getNaiSettings();
        return !!(e && e.floatingBallEnabled)
    }

    function nlSetFloatingEnabled(e) {
        var t = _getNaiSettings();
        t && (t.floatingBallEnabled = !!e, _saveNaiSettings()), nlRefreshFloatingBall()
    }

    function nlCurrentPresetName() {
        try {
            var e = W();
            return e && (e.yusheid_novelai || "") || ""
        } catch (e) {
            return ""
        }
    }

    function nlSetFloatingBallPanelOpen(e) {
        var t = s.getElementById("nl-floating-ball-v2");
        t && (t.style.display = e ? "none" : "flex")
    }

    function nlOpenPresetSwitcherPanel() {
        var e = N();
        e && (e.style.display = "flex", nlSetFloatingBallPanelOpen(!0), M("lib"))
    }

    function nlPositionFloatingBall(e, t, n) {
        var r = 46, a = Math.max(8, (window.innerWidth || s.documentElement.clientWidth || 360) - r - 8), i = Math.max(8, (window.innerHeight || s.documentElement.clientHeight || 640) - r - 8);
        t = Math.min(Math.max(8, t), a), n = Math.min(Math.max(8, n), i), e.style.left = t + "px", e.style.top = n + "px", e.style.right = "auto", e.style.bottom = "auto"
    }

    function nlBindFloatingDrag(e) {
        if (e._nlDragBound) return;
        e._nlDragBound = !0;
        var t = 0, n = 0, r = 0, a = 0, i = !1;
        function o(o) {
            var l = o.touches && o.touches[0] || o;
            t = l.clientX, n = l.clientY, r = e.offsetLeft || 0, a = e.offsetTop || 0, i = !1, e._nlMoved = !1
        }
        function l(o) {
            if (!t && !n) return;
            var l = o.touches && o.touches[0] || o, c = l.clientX - t, d = l.clientY - n;
            (Math.abs(c) > 4 || Math.abs(d) > 4) && (i = !0, e._nlMoved = !0), i && (nlPositionFloatingBall(e, r + c, a + d), o.cancelable && o.preventDefault())
        }
        function c() {
            if (t || n) {
                var r = _getNaiSettings();
                r && (r.floatingBallPos = {
                    left: e.offsetLeft || 0,
                    top: e.offsetTop || 0
                }, _saveNaiSettings())
            }
            t = n = 0, setTimeout(function() {
                e._nlMoved = !1
            }, 80)
        }
        e.addEventListener("mousedown", o), window.addEventListener("mousemove", l), window.addEventListener("mouseup", c), e.addEventListener("touchstart", o, {
            passive: !1
        }), window.addEventListener("touchmove", l, {
            passive: !1
        }), window.addEventListener("touchend", c)
    }

    async function nlRefreshFloatingBall() {
        var e = s.getElementById("nl-floating-ball-v2");
        if (!nlGetFloatingEnabled()) return void(e && e.remove());
        if (!e) {
            e = s.createElement("div"), e.id = "nl-floating-ball-v2", e.setAttribute("style", "position:fixed;width:46px;height:46px;border-radius:50%;z-index:99999;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);border:1px solid rgba(124,108,255,.55);box-shadow:0 8px 22px rgba(40,55,70,.26);cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);"), s.body.appendChild(e);
            var t = _getNaiSettings(), n = t && t.floatingBallPos;
            n && "number" == typeof n.left && "number" == typeof n.top ? nlPositionFloatingBall(e, n.left, n.top) : nlPositionFloatingBall(e, (window.innerWidth || 360) - 64, (window.innerHeight || 640) - 138);
            nlBindFloatingDrag(e), e.addEventListener("click", function(t) {
                t.preventDefault(), t.stopPropagation(), e._nlMoved || nlOpenPresetSwitcherPanel()
            })
        }
        var r = nlCurrentPresetName(), a = null;
        try {
            var i = await I.all();
            a = i.filter(function(e) {
                return (e.name || "").trim() === (r || "").trim()
            })[0] || null
        } catch (e) {}
        e.title = r ? "打开 NAI切换助手：" + r : "打开 NAI切换助手";
        e.innerHTML = a && a.thumb ? '<img src="' + a.thumb + '" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;">' : '<div style="font-size:16px;color:#8a97a4;line-height:1;pointer-events:none;font-weight:700;">NAI</div>'
    }

    function _getChatu8Settings() {
        try {
            var ctx = window.parent && window.parent.SillyTavern && window.parent.SillyTavern.getContext && window.parent.SillyTavern.getContext();
            var ext = ctx && ctx.extensionSettings || (window.parent && window.parent.extension_settings);
            return ext && ext["st-chatu8"] || null
        } catch (e) {
            return null
        }
    }

    function _getChatu8ServerStorage() {
        var st = _getChatu8Settings();
        return st ? (st.configImageStorage && "object" == typeof st.configImageStorage || (st.configImageStorage = {}), st.configImageStorage) : null
    }

    function _shouldUseChatu8ServerStorage() {
        var st = _getChatu8Settings();
        return !!st
    }

    function _getStHeaders() {
        var w = window.parent || window;
        try {
            if ("function" == typeof w.getRequestHeaders) return w.getRequestHeaders()
        } catch (e) {}
        try {
            var ctx = w.SillyTavern && w.SillyTavern.getContext && w.SillyTavern.getContext();
            if (ctx && "function" == typeof ctx.getRequestHeaders) return ctx.getRequestHeaders()
        } catch (e) {}
        var h = { "Content-Type": "application/json" };
        try { w.token && (h.Authorization = "Bearer " + w.token) } catch (e) {}
        return h
    }

    function _utf8ToBase64(e) {
        try { return btoa(unescape(encodeURIComponent(e))) }
        catch (t) { return btoa(e) }
    }

    function _stripDataUrl(e) {
        return "string" == typeof e && e.indexOf(",") > -1 ? e.split(",").pop() : e
    }

    async function _uploadChatu8Config(e, t, n, r) {
        var body = { image: t, format: n || "png", ch_name: "config" };
        r && (body.filename = r);
        var res = await fetch("/api/files/upload", {
            method: "POST",
            headers: _getStHeaders(),
            body: JSON.stringify(body),
            credentials: "include"
        });
        if (!res || !res.ok) throw new Error("upload failed: " + (res && res.status));
        var json = await res.json();
        if (!json || !json.path) throw new Error("upload missing path");
        return json.path
    }

    function _getImageFormat(e) {
        var t = "string" == typeof e && e.match(/^data:image\/([^;,]+)/i);
        return t ? ("jpeg" === t[1].toLowerCase() ? "jpg" : t[1].toLowerCase()) : "png"
    }

    async function _mirrorVibeImage(e, t, n) {
        var r = _getChatu8ServerStorage();
        if (!r || !e || !t) return !1;
        if (r[e] && r[e].path) return !0;
        try {
            var a = "text" === n, i = a ? _utf8ToBase64(t) : _stripDataUrl(t), o = a ? "png" : _getImageFormat(t), l = (a ? "vibe_" : "vibe_preview_") + e;
            r[e] = { path: await _uploadChatu8Config(e, i, o, l), date: Date.now() };
            a && (r[e].type = "text");
            _saveNaiSettings();
            return !0
        } catch (a) {
            return !1
        }
    }

    async function _restoreVibeImage(e) {
        try {
            var t = _getChatu8ServerStorage(), n = t && t[e];
            if (!n) return null;
            if (n.data) return await A(e, n.data, !0), n;
            if (n.path) {
                var r = await fetch(n.path);
                if (!r || !r.ok) return n;
                if ("text" === n.type) {
                    var a = await r.text();
                    try { a.indexOf("data:") === 0 && (a = decodeURIComponent(escape(atob(a.split(",").pop())))) } catch (e) {}
                    await A(e, a, !0)
                } else {
                    var i = await r.blob(), o = await new Promise(function(e) { var t = new FileReader; t.onloadend = function() { e(t.result) }, t.onerror = function() { e("") }, t.readAsDataURL(i) });
                    o && await A(e, o, !0)
                }
            }
            return n
        } catch (e) {
            return null
        }
    }

    function _collectReferencedVibeImageIds() {
        var ids = {}, st = _getChatu8Settings();
        try {
            var presets = st && st.vibePresets || {};
            Object.keys(presets).forEach(function(k) {
                var v = presets[k];
                v && v.vibeDataId && (ids[v.vibeDataId] = !0);
                v && v.imageId && (ids[v.imageId] = !0)
            });
            var groups = st && st.vibeGroups || {};
            Object.keys(groups).forEach(function(k) {
                var g = groups[k];
                g && g.imageId && (ids[g.imageId] = !0);
                g && Array.isArray(g.vibes) && g.vibes.forEach(function(v) {
                    v && v.vibeDataId && (ids[v.vibeDataId] = !0)
                })
            })
        } catch (e) {}
        return ids
    }

    async function _syncVibeImageMirror() {
        try {
            var server = _getChatu8ServerStorage();
            if (!server) return;
            for (var sid of Object.keys(server)) {
                var saved = server[sid];
                if (saved && saved.data) {
                    A(sid, saved.data, !0).catch(function() {});
                    await _mirrorVibeImage(sid, saved.data, saved.type || (0 === String(saved.data).indexOf("data:image/") ? "image" : "text"));
                    server[sid] && server[sid].path && delete server[sid].data
                }
            }
            var ns = _getNaiSettings();
            if (ns && ns.vibeImages && "object" == typeof ns.vibeImages) {
                Object.keys(ns.vibeImages).forEach(function(id) {
                    var saved = ns.vibeImages[id];
                    saved && saved.data && !server[id] && (server[id] = saved)
                });
                delete ns.vibeImages;
                for (var mid of Object.keys(server)) {
                    var merged = server[mid];
                    if (merged && merged.data) {
                        await _mirrorVibeImage(mid, merged.data, merged.type || (0 === String(merged.data).indexOf("data:image/") ? "image" : "text"));
                        server[mid] && server[mid].path && delete server[mid].data
                    }
                }
            }
            if (ns && !ns.__vibeImagesMirrored) {
                var refs = _collectReferencedVibeImageIds();
                var oldVibeImages = await new Promise(function(resolve) {
                    var req = indexedDB.open("chatu8_config_images", 2);
                    req.onupgradeneeded = function(ev) {
                        var db = ev.target.result;
                        if (!db.objectStoreNames.contains("config_images")) db.createObjectStore("config_images", { keyPath: "id" });
                    };
                    req.onsuccess = function(ev) {
                        try {
                            var db = ev.target.result;
                            var tx = db.transaction("config_images", "readonly");
                            var all = tx.objectStore("config_images").getAll();
                            all.onsuccess = function() { resolve(all.result || []); };
                            all.onerror = function() { resolve([]); };
                        } catch (e) { resolve([]); }
                    };
                    req.onerror = function() { resolve([]); };
                });
                for (var oldImg of oldVibeImages) {
                    oldImg && oldImg.id && oldImg.data && refs[oldImg.id] && !server[oldImg.id] && (server[oldImg.id] = oldImg);
                    oldImg && oldImg.id && oldImg.data && refs[oldImg.id] && await _mirrorVibeImage(oldImg.id, oldImg.data, oldImg.type || (0 === String(oldImg.data).indexOf("data:image/") ? "image" : "text"));
                    oldImg && oldImg.id && server[oldImg.id] && server[oldImg.id].path && delete server[oldImg.id].data
                }
                ns.__vibeImagesMirrored = true;
            }
            _saveNaiSettings()
        } catch (e) {}
    }

    /* --- 从 localStorage / IndexedDB 一次性迁移旧数据 --- */
    async function _migrateOldData() {
        if (_naiSettingsReady) return;
        var ns = _getNaiSettings();
        if (!ns) return;
        /* 标记已完成迁移 */
        if (ns.__migrated) { _naiSettingsReady = true; await _syncVibeImageMirror(); await _repairMissingVibeThumbnails(); return; }

        /* 1) 迁移分类 */
        try {
            var cats = JSON.parse(localStorage.getItem("nai_lib_categories_v2"));
            if (Array.isArray(cats) && cats.length) ns.categories = cats;
        } catch (e) {}

        /* 2) 迁移已删除列表 */
        try {
            var del = JSON.parse(localStorage.getItem("nai_lib_deleted_chatu_v2"));
            if (Array.isArray(del)) ns.deleted = del;
        } catch (e) {}

        /* 3) 迁移主题 */
        try {
            var theme = localStorage.getItem("nai_lib_theme_v2");
            if (theme) ns.theme = theme;
        } catch (e) {}

        /* 4) 迁移 IndexedDB entries */
        try {
            var oldEntries = await new Promise(function(resolve, reject) {
                var req = indexedDB.open("NAI_Prompt_Library_DB", 1);
                req.onupgradeneeded = function(ev) {
                    var db = ev.target.result;
                    if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
                };
                req.onsuccess = function(ev) {
                    try {
                        var db = ev.target.result;
                        var tx = db.transaction("entries", "readonly");
                        var all = tx.objectStore("entries").getAll();
                        all.onsuccess = function() { resolve(all.result || []); };
                        all.onerror = function() { resolve([]); };
                    } catch (e) { resolve([]); }
                };
                req.onerror = function() { resolve([]); };
            });
            if (oldEntries.length && (!ns.entries || !Object.keys(ns.entries).length)) {
                ns.entries = {};
                oldEntries.forEach(function(entry) {
                    if (entry && entry.id) ns.entries[entry.id] = entry;
                });
            }
        } catch (e) {}

        await _syncVibeImageMirror();
        await _repairMissingVibeThumbnails();

        ns.__migrated = true;
        _naiSettingsReady = true;
        _saveNaiSettings();

        /* 清除旧 localStorage（可选，不阻塞） */
        try { localStorage.removeItem("nai_lib_categories_v2"); } catch (e) {}
        try { localStorage.removeItem("nai_lib_deleted_chatu_v2"); } catch (e) {}
        try { localStorage.removeItem("nai_lib_theme_v2"); } catch (e) {}
    }
    /* ===== 持久化存储层结束 ===== */

    let c = null,
        d = [],
        p = "__all__",
        u = "",
        v = "grid",
        b = !1,
        g = new Set;

    function applyPresetVibeBinding(e) {
        var t = W(),
            n = re() || {};
        if (!t) return;
        var r = !!(e && e.vibeEnabled),
            a = r && e.vibeGroup && n[e.vibeGroup] ? e.vibeGroup : n["默认组"] ? "默认组" : Object.keys(n)[0] || "";
        t.enableVibeGroupTransfer = r && a ? "true" : "false";
        if (a) {
            if (r && e.vibeStrengths && n[a] && n[a].vibes) {
                var i = e.vibeStrengths || {};
                n[a].vibes.forEach(function(e) {
                    "number" == typeof i[e.vibeDataId] && (e.strength = i[e.vibeDataId])
                })
            }
            ie(a)
        } else X();
        try {
            var o = window.parent && window.parent.document || s,
                l = window.parent && (window.parent.jQuery || window.parent.$),
                c = o.getElementById("enableVibeGroupTransfer");
            c && (c.checked = r, l ? l(c).prop("checked", r).trigger("change") : c.dispatchEvent(new Event("change", {
                bubbles: !0
            })))
        } catch (e) {}
    }

    function getCurrentVibeBinding() {
        var e = "function" == typeof oeGetActiveGroup ? oeGetActiveGroup() : "";
        return {
            vibeEnabled: !!e,
            vibeGroup: e || "默认组",
            vibeStrengths: e ? oeCollectGroupStrengths(e) : {}
        }
    }

    function nlGetChatuNaiParams() {
        var e = window.parent && window.parent.document || s,
            t = {};
        [{
            id: "novelai_sampler",
            key: "naiSampler"
        }, {
            id: "novelai_steps",
            key: "naiSteps"
        }, {
            id: "nai3Scale",
            key: "naiPromptGuidance"
        }, {
            id: "cfg_rescale",
            key: "naiPromptGuidanceRescale"
        }].forEach(function(n) {
            try {
                var r = e.getElementById(n.id);
                r && (t[n.key] = r.value)
            } catch (e) {}
        });
        return t
    }

    function nlApplyChatuNaiParams(e) {
        if (!e) return !1;
        var t = window.parent && window.parent.document || s,
            n = window.parent && (window.parent.jQuery || window.parent.$),
            r = !1;
        [{
            id: "novelai_sampler",
            key: "naiSampler"
        }, {
            id: "novelai_steps",
            key: "naiSteps"
        }, {
            id: "nai3Scale",
            key: "naiPromptGuidance"
        }, {
            id: "cfg_rescale",
            key: "naiPromptGuidanceRescale"
        }].forEach(function(a) {
            try {
                if (void 0 === e[a.key] || null === e[a.key]) return;
                var i = t.getElementById(a.id);
                i && (i.value = e[a.key], n ? n(i).val(e[a.key]).trigger("input").trigger("change") : (i.dispatchEvent(new Event("input", {
                    bubbles: !0
                })), i.dispatchEvent(new Event("change", {
                    bubbles: !0
                }))), r = !0)
            } catch (e) {}
        });
        return r
    }

    function nlGetSettingsNaiParams(e) {
        if (!e) return nlGetChatuNaiParams();
        function t(t, n) {
            var r = e.querySelector(t);
            return r ? r.value : n
        }
        return {
            naiSampler: t("#nl-set-nai-sampler", ""),
            naiSteps: t("#nl-set-nai-steps", ""),
            naiPromptGuidance: t("#nl-set-nai-guidance", ""),
            naiPromptGuidanceRescale: t("#nl-set-nai-rescale", "")
        }
    }

    function oeCollectGroupStrengths(e) {
        var t = (re() || {})[e],
            n = {};
        return t && t.vibes && t.vibes.forEach(function(e) {
            e && e.vibeDataId && "number" == typeof e.strength && (n[e.vibeDataId] = e.strength)
        }), n
    }

    function applyPresetEntry(n) {
        if (!W()) return void E("未检测到智绘姬（st-chatu8）", "error");
        const e = (n.name || "").trim();
        if (!e) return void E("该收藏没有名称", "warning");
        Y(e, n.positive || "", n.negative || "");
        nlApplyPresetParams(n);
        const t = function(e) {
            var t = W();
            if (!t) return !1;
            t.yusheid_novelai = e;
            var n = t.yushe && t.yushe[e] || {};
            X();
            try {
                var r = window.parent && window.parent.document || s,
                    a = window.parent && (window.parent.jQuery || window.parent.$),
                    i = r.getElementById("yusheid_novelai");
                return i && (i.value = e, a && a(i).val(e)), [{
                    id: "fixedPrompt_novelai",
                    val: n.fixedPrompt || ""
                }, {
                    id: "fixedPrompt_end_novelai",
                    val: n.fixedPrompt_end || ""
                }, {
                    id: "negativePrompt_novelai",
                    val: n.negativePrompt || ""
                }].forEach(function(e) {
                    var t = r.getElementById(e.id);
                    t && (t.value = e.val, a ? a(t).val(e.val).trigger("input").trigger("change") : (t.dispatchEvent(new Event("input", {
                        bubbles: !0
                    })), t.dispatchEvent(new Event("change", {
                        bubbles: !0
                    }))))
                }), !0
            } catch (e) {}
            return !1
        }(e);
        applyPresetVibeBinding(n), async function() {
            t ? E("已设为当前预设「" + e + "」", "success") : E("已写入预设，请在智绘姬面板确认", "info"), nlRefreshFloatingBall(), R()
        }()
    }

    function autoClassify(pos, neg) {
        var text = ((pos || "") + " " + (neg || "")).toLowerCase();

        function hasKeyword(w) {
            var escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            if (/^[a-z0-9]+$/.test(w)) {
                return new RegExp("(^|[^a-z0-9])" + escaped + "($|[^a-z0-9])").test(text)
            }
            return text.indexOf(w) !== -1
        }

        var gufengArtists = [
            "kang_yiqian", "yao_san_ge_ling", "shang fa", "nixiaozi",
            "richu_de_xiao_taiyang", "gou_haihaihaihai", "zengzhi zhixu", "ibuki satsuki"
        ];
        var RR = {
            "古风": ["hanfu", "qipao", "ancient china", "guzhuang", "tang dynasty", "han dynasty", "song dynasty", "ming dynasty", "chinese clothes", "chinese dress", "chinese robe", "chinese style", "traditional chinese", "wuxia", "xianxia", "taoist", "jade hairpin", "hairpin", "folding fan", "bamboo forest", "lotus", "ink painting", "oriental"].concat(gufengArtists),
            "西幻": ["fantasy", "elf", "knight", "armor", "medieval", "magic", "dragon", "wizard", "dwarf"],
            "现代": ["modern", "city", "street", "casual", "urban", "jacket", "jeans", "office", "school uniform"],
            "科幻": ["sci-fi", "scifi", "cyberpunk", "mecha", "spaceship", "futuristic", "neon", "android", "robot"],
            "二次元": ["anime", "anime style", "cel shading", "moe", "chibi", "illustration"],
            "写实": ["realistic", "photorealistic", "photo", "dslr", "raw photo", "8k", "realism"]
        };
        var strongGufeng = ["hanfu", "ancient china", "guzhuang", "tang dynasty", "han dynasty", "song dynasty", "ming dynasty", "chinese clothes", "chinese dress", "chinese robe", "traditional chinese", "wuxia", "xianxia"].concat(gufengArtists).some(hasKeyword);
        var hits = [];
        for (var k in RR) {
            if (RR[k].some(hasKeyword)) hits.push(k)
        }
        if (strongGufeng && hits.indexOf("古风") >= 0) {
            var westernOnly = ["elf", "knight", "dragon", "wizard", "dwarf", "medieval"];
            var hasWesternOnly = westernOnly.some(hasKeyword);
            if (!hasWesternOnly) hits = hits.filter(function(k) {
                return k !== "西幻"
            })
        }
        return hits.length ? hits : ["未分类"]
    }

    function f() {
        var ns = _getNaiSettings();
        if (ns && Array.isArray(ns.categories) && ns.categories.length) return ns.categories;
        try {
            const e = JSON.parse(localStorage.getItem(i));
            if (Array.isArray(e) && e.length) return e
        } catch (e) {}
        return l.slice()
    }

    function m(e) {
        var ns = _getNaiSettings();
        if (ns) {
            ns.categories = e;
            _saveNaiSettings();
        }
        try {
            localStorage.setItem(i, JSON.stringify(e))
        } catch (e) {}
    }

    function x(e) {
        if (!(e = (e || "").trim())) return !1;
        const t = f();
        return !(t.indexOf(e) >= 0) && (t.push(e), m(t), !0)
    }

    function h(e) {
        var t = e.category;
        return Array.isArray(t) && t.length ? t : "string" == typeof t && t.trim() ? [t.trim()] : ["未分类"]
    }

    function y() {
        var ns = _getNaiSettings();
        if (ns && Array.isArray(ns.deleted)) return ns.deleted;
        try {
            const e = JSON.parse(localStorage.getItem(o));
            if (Array.isArray(e)) return e
        } catch (e) {}
        return []
    }

    function w(e) {
        if (!(e = (e || "").trim())) return;
        const t = y();
        if (t.indexOf(e) < 0) {
            t.push(e);
            var ns = _getNaiSettings();
            if (ns) {
                ns.deleted = t;
                _saveNaiSettings();
            }
            try {
                localStorage.setItem(o, JSON.stringify(t))
            } catch (e) {}
        }
    }

    function k(e) {
        if ("string" != typeof e) return e;
        const t = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&#34;",
            "'": "&#39;"
        };
        return e.replace(/[&<>"']/g, e => t[e])
    }

    function E(t, n) {
        try {
            if (window.toastr) return void(toastr[n] || toastr.info)(t)
        } catch (e) {}
        console.log("[" + e + "] " + t)
    }

    function S() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(e) {
            const t = 16 * Math.random() | 0;
            return ("x" === e ? t : 3 & t | 8).toString(16)
        })
    }

    function L() {
        /* 保留旧 IndexedDB 打开函数仅供迁移使用，运行时不再依赖 */
        return new Promise((e, t) => {
            const n = indexedDB.open("NAI_Prompt_Library_DB", 1);
            n.onupgradeneeded = e => {
                const t = e.target.result;
                t.objectStoreNames.contains(a) || t.createObjectStore(a, {
                    keyPath: "id"
                })
            }, n.onsuccess = t => e(t.target.result), n.onerror = e => t(e.target.error)
        })
    }
    const I = {
            async put(e) {
                var ns = _getNaiSettings();
                if (ns) {
                    if (!ns.entries || typeof ns.entries !== "object") ns.entries = {};
                    ns.entries[e.id] = e;
                    _saveNaiSettings();
                } else {
                    const t = await L();
                    return new Promise((n, r) => {
                        const i = t.transaction(a, "readwrite");
                        i.objectStore(a).put(e), i.oncomplete = () => n(), i.onerror = e => r(e.target.error)
                    })
                }
            },
            async all() {
                var ns = _getNaiSettings();
                if (ns && ns.entries && typeof ns.entries === "object") {
                    return Object.values(ns.entries);
                }
                const e = await L();
                return new Promise((t, n) => {
                    const r = e.transaction(a, "readonly").objectStore(a).getAll();
                    r.onsuccess = () => t(r.result || []), r.onerror = e => n(e.target.error)
                })
            },
            async get(e) {
                var ns = _getNaiSettings();
                if (ns && ns.entries && ns.entries[e]) {
                    return ns.entries[e];
                }
                const t = await L();
                return new Promise((n, r) => {
                    const i = t.transaction(a, "readonly").objectStore(a).get(e);
                    i.onsuccess = () => n(i.result), i.onerror = e => r(e.target.error)
                })
            },
            async del(e) {
                var ns = _getNaiSettings();
                if (ns && ns.entries) {
                    delete ns.entries[e];
                    _saveNaiSettings();
                } else {
                    const t = await L();
                    return new Promise((n, r) => {
                        const i = t.transaction(a, "readwrite");
                        i.objectStore(a).delete(e), i.oncomplete = () => n(), i.onerror = e => r(e.target.error)
                    })
                }
            }
        },
        j = "config_images";

    function q() {
        return new Promise((e, t) => {
            const n = indexedDB.open("chatu8_config_images", 2);
            n.onupgradeneeded = e => {
                const t = e.target.result;
                t.objectStoreNames.contains(j) || t.createObjectStore(j, {
                    keyPath: "id"
                })
            }, n.onsuccess = t => e(t.target.result), n.onerror = e => t(e.target.error)
        })
    }

    function _() {
        return "cfgimg_" + S()
    }
    async function A(e, t, n, r) {
        const a = await q();
        return new Promise((i, o) => {
            const l = a.transaction(j, "readwrite");
            l.objectStore(j).put({
                id: e,
                data: t,
                date: Date.now()
            }), l.oncomplete = async () => {
                try {
                    !n && _shouldUseChatu8ServerStorage() && await _mirrorVibeImage(e, t, r)
                } catch (e) {}
                i()
            }, l.onerror = e => o(e.target.error)
        })
    }
    async function D(e) {
        const t = await q(),
            n = await new Promise((n, r) => {
                const a = t.transaction(j, "readonly").objectStore(j).get(e);
                a.onsuccess = () => n(a.result), a.onerror = e => r(e.target.error)
            });
        return n || await _restoreVibeImage(e)
    }
    async function z(e) {
        const t = await q();
        return new Promise((n, r) => {
            const a = t.transaction(j, "readwrite");
            a.objectStore(j).delete(e), a.oncomplete = () => n(), a.onerror = e => r(e.target.error)
        })
    }

    function P(e) {
        try {
            return new TextDecoder("utf-8").decode(e)
        } catch (t) {
            let n = "";
            for (let t = 0; t < e.length; t++) n += String.fromCharCode(e[t]);
            return n
        }
    }

    function O(e) {
        const t = e.data;
        if ("tEXt" === e.type) {
            let e = t.indexOf(0);
            return e < 0 && (e = t.length), {
                key: P(t.subarray(0, e)),
                value: P(t.subarray(e + 1))
            }
        }
        if ("iTXt" === e.type) {
            let e = 0,
                n = t.indexOf(0, e);
            const r = P(t.subarray(e, n));
            e = n + 1;
            const a = t[e];
            e += 2;
            let i = t.indexOf(0, e);
            return e = i + 1, i = t.indexOf(0, e), e = i + 1, 1 === a ? {
                key: r,
                value: ""
            } : {
                key: r,
                value: P(t.subarray(e))
            }
        }
        return null
    }

    function G(e) {
        let t = e.prompt || "",
            n = e.uc || "";
        return e.v4_prompt && e.v4_prompt.caption && e.v4_prompt.caption.base_caption && (t = e.v4_prompt.caption.base_caption || t), e.v4_negative_prompt && e.v4_negative_prompt.caption && e.v4_negative_prompt.caption.base_caption && (n = e.v4_negative_prompt.caption.base_caption || n), {
            positive: t,
            negative: n
        }
    }
    async function C(e) {
        const t = URL.createObjectURL(e);
        try {
            const e = await new Promise((e, n) => {
                const r = new Image;
                r.onload = () => e(r), r.onerror = n, r.src = t
            });
            let n = e.naturalWidth,
                r = e.naturalHeight;
            if (!n || !r) return "";
            const a = 480,
                i = Math.min(1, a / Math.max(n, r));
            n = Math.round(n * i), r = Math.round(r * i);
            const o = s.createElement("canvas");
            return o.width = n, o.height = r, o.getContext("2d").drawImage(e, 0, 0, n, r), o.toDataURL("image/jpeg", .82)
        } catch (e) {
            return ""
        } finally {
            URL.revokeObjectURL(t)
        }
    }
    async function T(e) {
        let t = null;
        const n = function(e) {
            const t = new DataView(e),
                n = new Uint8Array(e),
                r = [137, 80, 78, 71, 13, 10, 26, 10];
            for (let e = 0; e < 8; e++)
                if (n[e] !== r[e]) return null;
            let a = 8;
            const i = [];
            for (; a + 8 <= n.length;) {
                const e = t.getUint32(a),
                    r = P(n.subarray(a + 4, a + 8)),
                    o = a + 8,
                    l = n.subarray(o, o + e);
                if (i.push({
                        type: r,
                        data: l
                    }), a = o + e + 4, "IEND" === r) break
            }
            return i
        }(await e.arrayBuffer());
        if (n && (t = function(e) {
                const t = {};
                for (const n of e)
                    if ("tEXt" === n.type || "iTXt" === n.type) {
                        const e = O(n);
                        e && e.key && (t[e.key] = e.value)
                    } if (t.Comment) try {
                    const e = G(JSON.parse(t.Comment));
                    if (e.positive || e.negative) return {
                        positive: e.positive,
                        negative: e.negative,
                        source: "NovelAI"
                    }
                } catch (e) {}
                if (t.parameters) {
                    const e = t.parameters,
                        n = e.indexOf("Negative prompt:");
                    if (n >= 0) {
                        const t = e.substring(0, n).trim();
                        let r = e.substring(n + 16);
                        const a = r.match(/\n(Steps:|Sampler:|CFG)/);
                        return {
                            positive: t,
                            negative: (a ? r.substring(0, a.index) : r).trim(),
                            source: "SD WebUI"
                        }
                    }
                    return {
                        positive: e.trim(),
                        negative: "",
                        source: "SD WebUI"
                    }
                }
                return t.Description ? {
                    positive: t.Description,
                    negative: "",
                    source: "NovelAI"
                } : null
            }(n)), !t || !t.positive && !t.negative) {
            const n = await async function(e) {
                const t = URL.createObjectURL(e);
                try {
                    const a = await new Promise((e, n) => {
                            const r = new Image;
                            r.onload = () => e(r), r.onerror = n, r.src = t
                        }),
                        i = a.naturalWidth,
                        o = a.naturalHeight;
                    if (!i || !o) return null;
                    const l = s.createElement("canvas");
                    l.width = i, l.height = o;
                    const c = l.getContext("2d");
                    c.drawImage(a, 0, 0);
                    const d = c.getImageData(0, 0, i, o).data,
                        p = i * o;
                    let u = 0;

                    function n() {
                        const e = u++,
                            t = Math.floor(e / o);
                        return 1 & d[4 * (e % o * i + t) + 3]
                    }

                    function r() {
                        let e = 0;
                        for (let t = 0; t < 8; t++) e = e << 1 | n();
                        return e
                    }
                    const v = "stealth_pnginfo",
                        b = "stealth_pngcomp",
                        g = Math.max(v.length, b.length);
                    let f = "";
                    for (; f.length < g && u < p;) f += String.fromCharCode(r());
                    let m = !1,
                        x = !1;
                    if (f === v ? (x = !0, m = !1) : f === b && (x = !0, m = !0), !x) return null;
                    let h = 0;
                    for (let E = 0; E < 32; E++) h = h << 1 | n();
                    if (h <= 0 || h > p) return null;
                    const y = Math.ceil(h / 8),
                        w = new Uint8Array(y);
                    let $, k = 0;
                    for (let S = 0; S < y; S++) {
                        let L = 0;
                        for (let I = 0; I < 8; I++) k < h ? (L = L << 1 | n(), k++) : L <<= 1;
                        w[S] = L
                    }
                    if (m) try {
                        const j = new DecompressionStream("gzip"),
                            q = await new Response(new Blob([w]).stream().pipeThrough(j)).arrayBuffer();
                        $ = new TextDecoder("utf-8").decode(q)
                    } catch (_) {
                        return null
                    } else $ = new TextDecoder("utf-8").decode(w);
                    try {
                        const A = JSON.parse($);
                        if (A.Comment) try {
                            const D = G(JSON.parse(A.Comment));
                            return {
                                positive: D.positive,
                                negative: D.negative,
                                source: "NovelAI (隐写)"
                            }
                        } catch (z) {}
                        if (A.prompt) {
                            const P = G(A);
                            return {
                                positive: P.positive,
                                negative: P.negative,
                                source: "NovelAI (隐写)"
                            }
                        }
                        if (A.Description) return {
                            positive: A.Description,
                            negative: "",
                            source: "隐写"
                        }
                    } catch (O) {
                        return {
                            positive: $,
                            negative: "",
                            source: "隐写"
                        }
                    }
                    return null
                } catch (C) {
                    return null
                } finally {
                    URL.revokeObjectURL(t)
                }
            }(e);
            n && (t = n)
        }
        const r = await C(e);
        return t ? (t.thumb = r, t) : {
            positive: "",
            negative: "",
            source: "未识别",
            thumb: r
        }
    }

    function N() {
        let n = s.getElementById(r);
        return n || (function() {
            if (s.getElementById(t)) return;
            const e = `\n#${r}{--nl-accent:#7c6cff;--nl-accent-rgb:124,108,255;}#${r}{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:100000;display:none;background:rgba(20,24,30,.28);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}\n#${r} *{box-sizing:border-box;}#${r}{color-scheme:light;}#${r}.nl-dark{color-scheme:dark;}#${r} textarea,#${r} input:not([type=range]):not([type=checkbox]):not([type=file]),#${r} select{background:#fbfcfe !important;color:#1f2a33 !important;}#${r}.nl-dark textarea,#${r}.nl-dark input:not([type=range]):not([type=checkbox]):not([type=file]),#${r}.nl-dark select{background:#262b33 !important;color:#dde2e8 !important;border-color:rgba(255,255,255,.16) !important;}\n#${r} .nl-box{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(860px,94vw);height:min(82vh,820px);background:rgba(255,255,255,.92);color:#1f2a33;border:1px solid rgba(255,255,255,.7);border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 18px 60px rgba(40,55,70,.22);font-size:14px;}\n#${r} .nl-head{position:relative;z-index:10001;display:flex;align-items:center;gap:8px;padding:11px 16px;background:rgba(255,255,255,.45);border-bottom:1px solid rgba(120,140,160,.16);}\n#${r} .nl-head .nl-title{font-weight:600;font-size:13px;flex:0 0 auto;color:#2a3640;}
#${r} .nl-tabs{display:flex;gap:6px;margin-left:6px;}\n#${r} .nl-tab{padding:5px 12px;font-size:13px;border-radius:20px;cursor:pointer;background:rgba(255,255,255,.5);color:#566472;border:1px solid rgba(120,140,160,.18);transition:.18s;}\n#${r} .nl-tab:hover{background:rgba(255,255,255,.85);}\n#${r} .nl-tab.active{background:rgba(255,255,255,.95);color:#1f2a33;border-color:rgba(120,140,160,.3);box-shadow:0 2px 10px rgba(40,55,70,.12);}\n#${r} .nl-close{position:relative;z-index:10002;touch-action:manipulation;cursor:pointer;margin-left:auto;font-size:20px;line-height:1;padding:2px 9px;border-radius:10px;color:#7a8794;}\n#${r} .nl-close:hover{background:rgba(120,140,160,.16);color:#1f2a33;}\n#${r} .nl-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:16px;}\n#${r} .nl-drop{border:2px dashed rgba(120,140,160,.4);border-radius:14px;padding:22px;text-align:center;color:#6b7886;cursor:pointer;transition:.15s;background:rgba(255,255,255,.4);}\n#${r} .nl-drop:hover,#${r} .nl-drop.drag{border-color:#7a8794;color:#1f2a33;background:rgba(255,255,255,.7);}\n#${r} .nl-field{margin-top:14px;}\n#${r} .nl-label{font-size:12px;color:#7a8794;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;}\n#${r} .nl-ta{width:100%;min-height:72px;background:rgba(255,255,255,.7);border:1px solid rgba(120,140,160,.25);border-radius:10px;color:#1f2a33;padding:9px 11px;resize:vertical;font-family:inherit;line-height:1.5;}#${r} .nl-ta:focus{outline:none;border-color:#8fa3b5;background:rgba(255,255,255,.92);}#${r} .nl-vibe-empty{margin-top:8px;}#${r} .nl-vibe-empty .nl-btn{flex:none;width:100%;}#${r} .nl-vibe-body{display:flex;gap:12px;align-items:flex-start;margin-top:6px;}#${r} .nl-vibe-thumb{width:88px;height:88px;object-fit:cover;border-radius:10px;border:1px solid rgba(120,140,160,.3);flex:none;}#${r} .nl-vibe-ctrl{flex:1;display:flex;flex-direction:column;gap:9px;}#${r} .nl-vibe-row{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#7a8794;}#${r} .nl-vibe-row span{display:flex;justify-content:space-between;align-items:center;}#${r} .nl-vibe-row b{color:#3a4654;font-weight:600;}#${r} .nl-vibe-row select{width:100%;background:rgba(255,255,255,.7);border:1px solid rgba(120,140,160,.25);border-radius:8px;color:#1f2a33;padding:6px 8px;font-family:inherit;}#${r} .nl-vibe-row input[type=range]{width:100%;accent-color:#3a4654;}#${r} .nl-vibe-sec-title{font-size:13px;font-weight:600;color:#3a4654;margin-bottom:10px;}#${r} .nl-vibe-listwrap{max-height:330px;overflow-y:auto;padding-right:4px;}#${r} .nl-vibe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;}#${r} .nl-vibe-card{background:rgba(255,255,255,.55);border:1px solid rgba(120,140,160,.2);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;}#${r} .nl-vibe-card-thumb{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:7px;border:1px solid rgba(120,140,160,.25);}#${r} .nl-vibe-card-thumb.empty{display:flex;align-items:center;justify-content:center;font-size:24px;background:rgba(120,140,160,.1);color:#9aa7b3;}#${r} .nl-vibe-card-name{font-size:11px;color:#3a4654;line-height:1.25;word-break:break-all;max-height:28px;overflow:hidden;}#${r} .nl-vibe-card-acts{display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:center;}#${r} .nl-vibe-add,#${r} .nl-vibe-del{cursor:pointer;font-size:11px;padding:2px 7px;border-radius:7px;transition:.15s;text-align:center;}#${r} .nl-vibe-add{background:rgba(58,70,84,.85);color:#fff;}#${r} .nl-vibe-add:hover{background:#3a4654;}#${r} .nl-vibe-del{color:#b06070;background:rgba(176,96,112,.12);}#${r} .nl-vibe-del:hover{background:rgba(176,96,112,.25);}#${r} #nl-vibe-newgroup,#${r} #nl-vibe-renamegroup,#${r} #nl-vibe-delgroup,#${r} #nl-vibe-savegroup{flex:none;padding:7px 10px;font-size:12px;box-shadow:none;white-space:nowrap;}#${r} .nl-vibe-toggle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#7a8794;cursor:pointer;font-weight:400;}#${r} .nl-vibe-toggle input{accent-color:#3a4654;cursor:pointer;}#${r} .nl-dvibe-slots{display:flex;flex-direction:column;gap:8px;margin-top:8px;}#${r} .nl-dvibe-slots .nl-vibe-slot{display:flex;gap:9px;align-items:flex-start;background:rgba(255,255,255,.5);border:1px solid rgba(120,140,160,.2);border-radius:10px;padding:8px;}#${r} .nl-dvibe-slots .nl-vibe-slot-thumb{width:46px;height:46px;flex:none;object-fit:cover;border-radius:8px;border:1px solid rgba(120,140,160,.25);}#${r} .nl-dvibe-slots .nl-vibe-slot-thumb.empty{display:flex;align-items:center;justify-content:center;font-size:20px;background:rgba(120,140,160,.1);color:#9aa7b3;}#${r} .nl-dvibe-slots .nl-vibe-slot-body{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0;}#${r} .nl-dvibe-slots .nl-vibe-slot-name{font-size:12px;color:#3a4654;word-break:break-all;}#${r} .nl-dvibe-slots .nl-vibe-row{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#7a8794;}#${r} .nl-dvibe-slots .nl-vibe-row input[type=range]{width:100%;accent-color:#3a4654;}#${r} .nl-vibe-topbar{display:flex;gap:10px;align-items:center;margin-bottom:14px;}#${r} .nl-vibe-grouprow{display:flex;gap:8px;align-items:center;margin-bottom:10px;}@media(max-width:600px){#${r} .nl-vibe-listwrap{max-height:270px;}#${r} .nl-vibe-grid{grid-template-columns:repeat(4,1fr);gap:5px;}#${r} .nl-vibe-card{padding:4px;border-radius:8px;gap:3px;}#${r} .nl-vibe-card-thumb{border-radius:6px;}#${r} .nl-vibe-card-thumb.empty{font-size:18px;}#${r} .nl-vibe-card-name{font-size:10px;line-height:1.15;max-height:23px;}#${r} .nl-vibe-card-acts{gap:3px;}#${r} .nl-vibe-add,#${r} .nl-vibe-del{font-size:10px;padding:1px 4px;border-radius:6px;}#${r} .nl-vibe-grouprow{flex-wrap:wrap;gap:5px;}#${r} .nl-vibe-grouprow #nl-vibe-groupsel{flex:1 1 100% !important;padding:6px 8px !important;font-size:12px !important;}#${r} .nl-vibe-grouprow .nl-btn{flex:1 1 calc(25% - 4px);min-width:0 !important;font-size:11px !important;padding:5px 4px !important;min-height:28px !important;line-height:1.05 !important;}}#${r} .nl-vibe-grouprow #nl-vibe-groupsel{min-height:34px;padding:6px 10px !important;font-size:13px !important;border-radius:10px;}#${r} .nl-vibe-groupbtn{width:auto;min-height:30px !important;padding:6px 10px !important;font-size:12px !important;line-height:1.1 !important;border-radius:9px !important;white-space:nowrap;}#${r} .nl-vibe-groupcur .nl-vibe-groupbtn{min-height:30px !important;padding:6px 10px !important;}@media(max-width:600px){#${r} .nl-vibe-grouprow #nl-vibe-groupsel{min-height:34px !important;padding:6px 9px !important;font-size:12px !important;}#${r} .nl-vibe-grouprow .nl-vibe-groupbtn{flex:0 1 auto !important;min-width:0 !important;font-size:11px !important;padding:5px 8px !important;min-height:28px !important;border-radius:8px !important;}}#${r} .nl-vibe-groupcur{font-size:12px;color:#7a8794;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}#${r} .nl-vibe-slots{display:flex;flex-direction:column;gap:10px;}#${r} .nl-vibe-slot{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.5);border:1px solid rgba(120,140,160,.2);border-radius:11px;padding:9px;}#${r} .nl-vibe-slot-thumb{width:64px;height:64px;object-fit:cover;border-radius:9px;border:1px solid rgba(120,140,160,.25);flex:none;}#${r} .nl-vibe-slot-thumb.empty{display:flex;align-items:center;justify-content:center;font-size:26px;background:rgba(120,140,160,.1);color:#9aa7b3;}#${r} .nl-vibe-slot-body{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0;}#${r} .nl-vibe-slot-name{font-size:12px;color:#3a4654;font-weight:600;word-break:break-all;}#${r} .nl-vibe-slot-del{cursor:pointer;color:#b06070;font-size:13px;padding:2px 8px;border-radius:8px;align-self:flex-start;}#${r} .nl-vibe-slot-del:hover{background:rgba(176,96,112,.2);}#${r} .nl-input{width:100%;background:rgba(255,255,255,.7);border:1px solid rgba(120,140,160,.25);border-radius:10px;color:#1f2a33;padding:9px 11px;}\n#${r} .nl-input:focus{outline:none;border-color:#8fa3b5;}\n#${r} .nl-topbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}\n#${r} .nl-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;}\n#${r} .nl-search-wrap{position:relative;flex:1;min-width:0;}\n#${r} .nl-search{width:100%;padding:7px 14px;border:1px solid rgba(120,140,160,.22);border-radius:20px;background:rgba(255,255,255,.6);color:#3a4654;font-size:13px;outline:none;transition:.15s;}\n#${r} .nl-search:focus{background:#fff;border-color:#3a4654;}\n@media(max-width:600px){#${r} .nl-search-wrap{min-width:120px;}}\n#${r} .nl-chips{display:flex;flex-wrap:wrap;gap:8px;}\n#${r} .nl-chip{padding:4px 10px;border-radius:16px;background:rgba(255,255,255,.6);border:1px solid rgba(120,140,160,.22);cursor:pointer;color:#566472;font-size:12px;transition:.15s;}\n#${r} .nl-chip:hover{background:rgba(255,255,255,.9);}\n#${r} .nl-chip.active{background:#3a4654;border-color:transparent;color:#fff;}\n#${r} .nl-chip.addnew{border-style:dashed;color:#8a97a4;}\n#${r} .nl-btnrow{display:flex;gap:10px;margin-top:16px;}\n#${r} .nl-btn{flex:1;padding:11px;border:none;border-radius:12px;background:#3a4654;color:#fff;font-size:14px;cursor:pointer;transition:.18s;box-shadow:0 3px 12px rgba(40,55,70,.2);}\n#${r} .nl-btn:hover{filter:brightness(1.12);}\n#${r} .nl-btn.ghost{background:rgba(255,255,255,.7);color:#3a4654;box-shadow:none;border:1px solid rgba(120,140,160,.3);}\n#${r} .nl-btn.danger{background:#d9576a;box-shadow:0 3px 12px rgba(217,87,106,.25);}#${r} .nl-detail .nl-btn{padding:9px 11px !important;font-size:13px !important;min-height:34px !important;line-height:1.15 !important;box-sizing:border-box !important;}\n#${r} .nl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}\n#${r} .nl-card{background:rgba(255,255,255,.6);border:1px solid rgba(120,140,160,.2);border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}\n#${r} .nl-card:hover{transform:translateY(-3px);border-color:#8fa3b5;box-shadow:0 8px 22px rgba(40,55,70,.16);}\n#${r} .nl-thumb{width:100%;aspect-ratio:1/1;object-fit:cover;background:rgba(120,140,160,.12);display:block;-webkit-user-drag:none;}\n#${r} .nl-thumb.empty{display:flex;align-items:center;justify-content:center;color:rgba(120,140,160,.5);font-size:30px;}\n#${r} .nl-cardinfo{padding:9px 11px;}\n#${r} .nl-cardname{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2a3640;}\n#${r} .nl-cardcat{display:inline-block;margin-top:5px;font-size:11px;padding:2px 9px;border-radius:10px;background:rgba(120,140,160,.18);color:#566472;}\n#${r} .nl-grid.list-mode{grid-template-columns:1fr !important;gap:8px;}\n#${r} .nl-grid.list-mode .nl-card{display:flex;flex-direction:row;border-radius:10px;}\n#${r} .nl-grid.list-mode .nl-thumb{width:60px;height:60px;aspect-ratio:auto;border-radius:10px 0 0 10px;flex-shrink:0;}\n#${r} .nl-grid.list-mode .nl-thumb.empty{width:60px;height:60px;font-size:18px;}\n#${r} .nl-grid.list-mode .nl-cardinfo{display:flex;flex-direction:column;justify-content:center;padding:8px 12px;flex:1;min-width:0;}\n#${r} .nl-grid.list-mode .nl-cardname{font-size:14px;}\n#${r} .nl-card.is-current{border:2px solid #f0a020;box-shadow:0 0 8px rgba(240,160,32,.3);}\n#${r} .nl-card.is-current::after{content:'★ 使用中';position:absolute;top:6px;right:6px;background:rgba(240,160,32,.9);color:#fff;font-size:10px;padding:2px 7px;border-radius:8px;z-index:2;}\n#${r} .nl-card{position:relative;}\n#${r} .nl-viewtoggle{cursor:pointer;width:36px;height:36px;border-radius:8px;border:1px solid rgba(120,140,160,.22);background:rgba(255,255,255,.6);color:#7a8794;font-size:18px;transition:.15s;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}\n#${r} #nl-viewtoggle,#${r} #nl-randpick,#${r} #nl-multisel-btn{font-family:"Segoe UI Symbol","Noto Sans Symbols","Noto Sans Symbols2","Android Emoji","Noto Color Emoji",sans-serif!important;}#${r} #nl-randpick{font-size:24px;}#${r} #nl-multisel-btn{font-size:24px;}#${r} .nl-viewtoggle:hover{background:rgba(255,255,255,.9);}\n#${r} .nl-empty{text-align:center;color:#9aa7b4;padding:40px 0;}\n#${r} .nl-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center;}\n#${r} .nl-tag{display:inline-block;font-size:10px;padding:1px 7px;border-radius:8px;background:rgba(120,140,160,.18);color:#566472;}\n#${r} .nl-tagdropdown{position:relative;cursor:pointer;min-height:36px;padding:8px 32px 8px 10px;border:1px solid rgba(120,140,160,.3);border-radius:10px;background:rgba(255,255,255,.8);display:flex;flex-wrap:wrap;gap:4px;align-items:center;transition:.2s;}\n#${r} .nl-tagdropdown:hover{border-color:rgba(var(--nl-accent-rgb),.4);}\n#${r} .nl-tagdropdown::after{content:'▼';position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:#8a97a4;pointer-events:none;}\n#${r} .nl-tagdropdown .nl-placeholder{color:#8a97a4;font-size:13px;}\n#${r} .nl-tagpicker{position:fixed;inset:0;background:rgba(20,24,30,.45);z-index:9999;display:flex;align-items:center;justify-content:center;}\n#${r} .nl-tagpicker-box{background:#fff;border-radius:16px;padding:18px;width:min(340px,88vw);max-height:70vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25);}\n#${r} .nl-tagpicker-title{font-size:15px;font-weight:600;margin-bottom:12px;color:#2a3640;}\n#${r} .nl-tagpicker-item{display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid rgba(120,140,160,.12);cursor:pointer;transition:.1s;}\n#${r} .nl-tagpicker-item:hover{background:rgba(var(--nl-accent-rgb),.06);}\n#${r} .nl-tagpicker-item .nl-tcheck{width:20px;height:20px;border-radius:6px;border:2px solid #c0c8d0;display:flex;align-items:center;justify-content:center;font-size:13px;color:transparent;transition:.15s;flex-shrink:0;}\n#${r} .nl-tagpicker-item.checked .nl-tcheck{border-color:var(--nl-accent);background:var(--nl-accent);color:#fff;}\n#${r} .nl-tagpicker-item .nl-tname{font-size:14px;color:#3a4654;}\n#${r} .nl-tagpicker-foot{display:flex;gap:10px;margin-top:14px;}\n#${r} .nl-tagpicker-foot .nl-btn{flex:1;}\n#${r} .nl-card.selected{outline:3px solid var(--nl-accent);outline-offset:-3px;opacity:.85;}\n#${r} .nl-card.selected::before{content:'✓';position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:50%;background:var(--nl-accent);color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;z-index:3;}\n#${r} .nl-multibar{display:flex;gap:8px;align-items:center;padding:10px 14px;background:rgba(var(--nl-accent-rgb),.08);border-radius:12px;margin-bottom:10px;}\n#${r} .nl-multibar .nl-btn{padding:8px 14px;font-size:13px;white-space:nowrap;}\n#${r} .nl-detail{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(20,24,30,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:10003;}\n#${r} .nl-dbox{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(640px,92%);max-height:88%;overflow:auto;background:rgba(255,255,255,.78);backdrop-filter:blur(10px) saturate(150%);-webkit-backdrop-filter:blur(10px) saturate(150%);border:1px solid rgba(255,255,255,.7);border-radius:18px;padding:20px;box-shadow:0 18px 50px rgba(40,55,70,.25);}\n#${r} .nl-dimg{width:100%;max-height:280px;object-fit:contain;background:rgba(120,140,160,.12);border-radius:10px;}\n@media (max-width: 600px){
#${r} .nl-box{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:94vw;height:85vh;max-width:none;max-height:none;border-radius:16px;font-size:14px;}#${r} .nl-head{padding:12px 14px;gap:8px;flex-wrap:wrap;}#${r} .nl-head .nl-title{font-size:13px;}#${r} .nl-tabs{margin-left:0;width:100%;order:3;gap:6px;}#${r} .nl-tab{flex:1;text-align:center;padding:8px 6px;font-size:12px;}#${r} .nl-close{font-size:24px;padding:4px 12px;margin-left:auto;}#${r} .nl-body{padding:12px;}#${r} .nl-field{margin-top:12px;}#${r} .nl-input,#${r} .nl-ta{font-size:15px;padding:9px 10px;}#${r} .nl-btnrow{gap:8px;margin-top:12px;}#${r} .nl-btn{padding:9px 11px;font-size:13px;min-height:34px;}#${r} .nl-chips{gap:7px;}#${r} .nl-chip{padding:5px 10px;font-size:12px;}#${r} .nl-drop{padding:18px;}#${r} .nl-grid{grid-template-columns:repeat(3,1fr);gap:9px;}#${r} .nl-cardinfo{padding:6px 8px;}#${r} .nl-cardname{font-size:12px;}#${r} .nl-cardcat{font-size:10px;padding:2px 7px;margin-top:4px;}#${r} .nl-grid.list-mode{gap:12px;}#${r} .nl-grid.list-mode .nl-thumb,#${r} .nl-grid.list-mode .nl-thumb.empty{width:92px;height:92px;font-size:24px;}#${r} .nl-grid.list-mode .nl-cardinfo{padding:10px 14px;}#${r} .nl-grid.list-mode .nl-cardname{font-size:15px;}#${r} .nl-grid.list-mode .nl-cardcat{font-size:11px;padding:2px 9px;margin-top:5px;}#${r} .nl-dbox{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:92vw;max-width:none;max-height:85vh;border-radius:16px;padding:16px;}#${r} .nl-dimg{max-height:220px;}\n}\n#${r} .nl-theme{cursor:pointer;font-size:17px;line-height:1;padding:2px 8px;border-radius:10px;color:#7a8794;}#${r} .nl-theme:hover{background:rgba(120,140,160,.16);color:#1f2a33;}#${r}.nl-dark{background:rgba(8,10,14,.5);}#${r}.nl-dark .nl-box{background:rgba(26,30,38,.88);color:#dde2e8;border-color:rgba(255,255,255,.08);box-shadow:0 18px 60px rgba(0,0,0,.5);}#${r}.nl-dark .nl-head{background:rgba(255,255,255,.04);border-bottom-color:rgba(255,255,255,.08);}#${r}.nl-dark .nl-title{color:#dde2e8;}#${r}.nl-dark .nl-theme,#${r}.nl-dark .nl-close{color:#aab4bf;}#${r}.nl-dark .nl-theme:hover,#${r}.nl-dark .nl-close:hover{background:rgba(255,255,255,.1);color:#fff;}#${r}.nl-dark .nl-tab{background:rgba(255,255,255,.06);color:#aab4bf;border-color:rgba(255,255,255,.1);}#${r}.nl-dark .nl-tab:hover{background:rgba(255,255,255,.12);}#${r}.nl-dark .nl-tab.active{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.18);box-shadow:none;}#${r}.nl-dark .nl-drop{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.18);color:#aab4bf;}#${r}.nl-dark .nl-drop:hover,#${r}.nl-dark .nl-drop.drag{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.35);color:#fff;}#${r}.nl-dark .nl-label{color:#9aa7b4;}#${r}.nl-dark .nl-ta,#${r}.nl-dark .nl-input,#${r}.nl-dark .nl-search{background:rgba(255,255,255,.06);color:#dde2e8;border-color:rgba(255,255,255,.14);}#${r}.nl-dark .nl-ta:focus,#${r}.nl-dark .nl-input:focus{background:rgba(255,255,255,.1);border-color:#8fa3b5;}#${r}.nl-dark .nl-search:focus{background:rgba(255,255,255,.12);border-color:#8fa3b5;}#${r}.nl-dark .nl-chip{background:rgba(255,255,255,.06);color:#b6c0ca;border-color:rgba(255,255,255,.12);}#${r}.nl-dark .nl-chip:hover{background:rgba(255,255,255,.14);}#${r}.nl-dark .nl-chip.active{background:#5a6b80;color:#fff;border-color:transparent;}#${r}.nl-dark .nl-chip.addnew{color:#8a97a4;}#${r}.nl-dark .nl-viewtoggle,#${r}.nl-dark #nl-randpick,#${r}.nl-dark #nl-multisel-btn{background:rgba(255,255,255,.06);color:#aab4bf;border-color:rgba(255,255,255,.12);}#${r}.nl-dark .nl-viewtoggle:hover{background:rgba(255,255,255,.14);}#${r}.nl-dark .nl-card{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);}#${r}.nl-dark .nl-card:hover{border-color:#8fa3b5;box-shadow:0 8px 22px rgba(0,0,0,.4);}#${r}.nl-dark .nl-cardname{color:#dde2e8;}#${r}.nl-dark .nl-cardcat{background:rgba(255,255,255,.1);color:#b6c0ca;}#${r}.nl-dark .nl-thumb{background:rgba(255,255,255,.06);}#${r}.nl-dark .nl-thumb.empty{color:rgba(255,255,255,.35);}#${r}.nl-dark .nl-btn.ghost{background:rgba(255,255,255,.08);color:#dde2e8;border-color:rgba(255,255,255,.16);}#${r}.nl-dark .nl-empty{color:#8a97a4;}#${r}.nl-dark .nl-multibar{background:rgba(var(--nl-accent-rgb),.16);}#${r}.nl-dark .nl-rback{background:#2a3340 !important;border-color:rgba(120,150,190,.3) !important;}#${r}.nl-dark .nl-rback>span{color:#6d8bb0 !important;text-shadow:0 2px 10px rgba(0,0,0,.4) !important;}@media(max-width:600px){#${r} .nl-multibar{flex-wrap:wrap;}#${r} .nl-multibar .nl-btn{flex:1 1 auto;white-space:nowrap;}}#${r}.nl-dark .nl-tag{background:rgba(255,255,255,.1);color:#b6c0ca;}#${r}.nl-dark .nl-tagdropdown{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);}#${r}.nl-dark .nl-tagdropdown::after{color:#aab4bf;}#${r}.nl-dark .nl-placeholder{color:#8a97a4;}#${r}.nl-dark .nl-tagpicker-box{background:rgba(30,34,42,.97);color:#dde2e8;}#${r}.nl-dark .nl-tagpicker-title{color:#eef1f4;}#${r}.nl-dark .nl-tagpicker-item{border-bottom-color:rgba(255,255,255,.08);}#${r}.nl-dark .nl-tagpicker-item:hover{background:rgba(var(--nl-accent-rgb),.14);}#${r}.nl-dark .nl-tname{color:#dde2e8;}#${r}.nl-dark .nl-tcheck{border-color:#5a6470;}#${r}.nl-dark .nl-dbox{background:rgba(26,30,38,.93);color:#dde2e8;border-color:rgba(255,255,255,.08);}#${r}.nl-dark .nl-dimg{background:rgba(255,255,255,.06);}#${r}.nl-dark .nl-vibe-sec-title,#${r}.nl-dark .nl-vibe-slot-name,#${r}.nl-dark .nl-vibe-card-name,#${r}.nl-dark .nl-vibe-row b{color:#dde2e8;}#${r}.nl-dark .nl-vibe-row,#${r}.nl-dark .nl-vibe-groupcur,#${r}.nl-dark .nl-vibe-toggle{color:#9aa7b4;}#${r}.nl-dark .nl-vibe-card,#${r}.nl-dark .nl-vibe-slot{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);}#${r}.nl-dark .nl-vibe-thumb,#${r}.nl-dark .nl-vibe-card-thumb,#${r}.nl-dark .nl-vibe-slot-thumb{border-color:rgba(255,255,255,.14);}#${r}.nl-dark .nl-vibe-row select,#${r}.nl-dark #nl-vibe-groupsel,#${r}.nl-dark .nl-vibe-grouprow select{background:rgba(40,46,56,.95);color:#dde2e8;border-color:rgba(255,255,255,.14);}`,
                n = s.createElement("style");
            n.id = t, n.textContent = e, s.head.appendChild(n)
        }(), n = s.createElement("div"), n.id = r, n.innerHTML = `\n<div class="nl-box"><div class="nl-head"><span class="nl-title">${e}</span><div class="nl-tabs"><div class="nl-tab active" data-tab="lib">收藏库</div><div class="nl-tab" data-tab="vibe">Vibe 库</div><div class="nl-tab" data-tab="parse">设置</div></div><span class="nl-theme" title="日夜切换">◐</span><span class="nl-close">&times;</span></div><div class="nl-body" data-view="lib"></div><div class="nl-body" data-view="parse" style="display:none;"></div><div class="nl-body" data-view="vibe" style="display:none;"></div>\n</div>`, s.body.appendChild(n),
        n._nlClosePresetSwitcherPanel = function(e) {
            try {
                e && (e.preventDefault(), e.stopPropagation());
                var ok = nlConfirmVibePendingIfVibeTab();
                if (ok) {
                    try { closeModal(); } catch (err) {}
                    n.style.display = "none";
                    try { nlSetFloatingBallPanelOpen(!1); } catch (err) {}
                }
            } catch (err) {}
        }, n._nlCloseBtn = n.querySelector(".nl-close"), n._nlCloseBtn.addEventListener("click", n._nlClosePresetSwitcherPanel), window.PointerEvent && n._nlCloseBtn.addEventListener("pointerup", n._nlClosePresetSwitcherPanel), (function() {
            try {
                var _ns = _getNaiSettings();
                var _thm = _ns && _ns.theme || null;
                if (!_thm) try { _thm = localStorage.getItem("nai_lib_theme_v2"); } catch(e){}
                if (_thm === "dark") n.classList.add("nl-dark")
            } catch (e) {}
            var _tb = n.querySelector(".nl-theme");
            _tb && _tb.addEventListener("click", function() {
                var dk = n.classList.toggle("nl-dark");
                var _ns2 = _getNaiSettings();
                if (_ns2) {
                    _ns2.theme = dk ? "dark" : "light";
                    _saveNaiSettings();
                }
                try {
                    localStorage.setItem("nai_lib_theme_v2", dk ? "dark" : "light")
                } catch (e) {}
            })
        })(), n.addEventListener("click", e => {
            e.target === n && n._nlClosePresetSwitcherPanel(e)
        }), window.PointerEvent && n.addEventListener("pointerup", e => {
            e.target === n && n._nlClosePresetSwitcherPanel(e)
        }), n.querySelectorAll(".nl-tab").forEach(e => {
            e.addEventListener("click", () => M(e.getAttribute("data-tab")))
        }), n)
    }

    function M(e) {
        const t = s.getElementById(r);
        if (!t) return;
        var n = t.querySelector(".nl-tab.active"),
            a = n && n.getAttribute("data-tab");
        if (a === e) return;
        if ("vibe" === a && !nlConfirmVibePending()) return;
        t.querySelectorAll(".nl-tab").forEach(t => t.classList.toggle("active", t.getAttribute("data-tab") === e)), t.querySelectorAll(".nl-body").forEach(t => {
            t.style.display = t.getAttribute("data-view") === e ? "" : "none"
        }), "parse" === e ? B() : "vibe" === e ? le() : R()
    }

    function B() {
        const e = s.getElementById(r).querySelector('.nl-body[data-view="parse"]'),
            t = c;
        nlEnsureDefaultParamGroup();
        nlBindChatuNaiParamReverseSync();
        var currentParamGroup = nlGetActiveParamGroup(),
            currentParamGroups = nlGetParamGroups(),
            currentNaiParams = currentParamGroup && currentParamGroups[currentParamGroup] && currentParamGroups[currentParamGroup].params ? currentParamGroups[currentParamGroup].params : nlReadAllNaiParams(),
            currentParamKeys = Object.keys(currentParamGroups).sort(function(a,b){ return a===NL_DEFAULT_PARAM_GROUP?-1:b===NL_DEFAULT_PARAM_GROUP?1:a.localeCompare(b,"zh-CN"); }),
            currentParamOptions = currentParamKeys.map(function(g){ return '<option value="'+k(g)+'"'+(g===currentParamGroup?' selected':'')+'>'+k(g)+'</option>'; }).join("");
        e.innerHTML = `\n<div class="nl-drop" id="nl-drop" style="${t?"display:none;":""}">点击或拖入 NovelAI / SD 图片解析提示词</div>\n<input type="file" id="nl-file" accept="image/*" style="display:none;">\n<div class="nl-drop" id="nl-directimport" style="margin-top:10px;${t?"display:none;":""}">直接导入（手动填写）</div>\n<div class="nl-field" id="nl-floating-settings" style="margin-top:10px;border:1px solid rgba(120,140,160,.25);border-radius:10px;padding:10px;background:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:space-between;gap:12px;${t?"display:none;":""}"><div><div style="font-size:13px;color:#566472;font-weight:600;">悬浮球</div><div style="font-size:12px;color:#8a97a4;margin-top:3px;">圆形显示当前预设预览图</div></div><label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#566472;white-space:nowrap;"><input type="checkbox" id="nl-floating-toggle"${nlGetFloatingEnabled()?" checked":""}> 开启悬浮球</label></div>\n<div class="nl-field" id="nl-settings-nai-params" style="margin-top:10px;border:1px solid rgba(120,140,160,.25);border-radius:10px;padding:10px;background:rgba(255,255,255,.5);${t?"display:none;":""}"><div style="font-size:13px;color:#566472;font-weight:600;margin-bottom:8px;">智绘姬参数</div><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><select class="nl-input" id="nl-set-param-group" style="flex:1 1 auto;min-width:0;margin:0;">${currentParamOptions || '<option value="">（暂无参数组）</option>'}</select><button class="nl-btn ghost nl-set-param-btn" data-pa="new" style="flex:0 0 auto;font-size:11px!important;padding:4px 6px!important;min-height:26px!important;line-height:1.1!important;">新建</button><button class="nl-btn ghost nl-set-param-btn" data-pa="rename" style="flex:0 0 auto;font-size:11px!important;padding:4px 6px!important;min-height:26px!important;line-height:1.1!important;">重命名</button><button class="nl-btn ghost nl-set-param-btn" data-pa="del" style="flex:0 0 auto;font-size:11px!important;padding:4px 6px!important;min-height:26px!important;line-height:1.1!important;">删组</button></div><div id="nl-set-param-fields" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">${nlRenderParamFieldInputs("nl-set-pf-", currentNaiParams)}</div></div>\n<div id="nl-result" style="${t?"":"display:none;"}"><div class="nl-field"><div class="nl-label"><span>来源：${t?k(t.source||""):""}</span></div>${t&&t.thumb?`<img src="${t.thumb}" class="nl-dimg" id="nl-parse-thumb" style="max-height:200px;margin-bottom:6px;cursor:pointer;" title="点击更换">`:'<div id="nl-parse-thumb" style="cursor:pointer;text-align:center;padding:16px;border:1px dashed rgba(120,140,160,.3);border-radius:10px;color:#8a97a4;font-size:13px;">点击上传预览图（可选）</div>'}<input type="file" id="nl-parse-thumbfile" accept="image/*" style="display:none;"></div><div class="nl-field"><div class="nl-label"><span>正面提示词</span><span class="nl-acts" style="display:inline-flex;align-items:center;gap:9px;"><span class="nl-copy" data-copy="pos" style="cursor:pointer;color:#7a8794;font-size:14px;line-height:1;" title="复制">⧉</span><span class="nl-expand" data-exp="pos" style="cursor:pointer;color:#7a8794;font-size:18px;line-height:1;" title="展开">⤢</span></span></div><textarea class="nl-ta" id="nl-pos">${t?k(t.positive||""):""}</textarea></div><div class="nl-field"><div class="nl-label"><span>负面提示词</span><span class="nl-acts" style="display:inline-flex;align-items:center;gap:9px;"><span class="nl-copy" data-copy="neg" style="cursor:pointer;color:#7a8794;font-size:14px;line-height:1;" title="复制">⧉</span><span class="nl-expand" data-exp="neg" style="cursor:pointer;color:#7a8794;font-size:18px;line-height:1;" title="展开">⤢</span></span></div><textarea class="nl-ta" id="nl-neg">${t?k(t.negative||""):""}</textarea></div><div class="nl-field"><div class="nl-label"><span>命名</span></div><input class="nl-input" id="nl-name" placeholder="给这组提示词起个名字，例如：清冷古风少女"></div><div class="nl-field"><div class="nl-label"><span>预设标签</span></div><div class="nl-tags" id="nl-parse-tags" style="cursor:pointer;min-height:32px;padding:6px;border:1px solid rgba(120,140,160,.25);border-radius:10px;background:rgba(255,255,255,.7);"><span class="nl-tag" style="color:#8a97a4;border:1px dashed #aaa;background:transparent;">点击选择标签</span></div></div><div class="nl-btnrow"><button class="nl-btn ghost" id="nl-parse-close" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">关闭</button><button class="nl-btn" id="nl-save" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">保存到收藏库</button></div>\n</div>`;
        const n = e.querySelector("#nl-parse-tags");

        function a() {
            d.length ? n.innerHTML = d.map(e => `<span class="nl-tag">${k(e)}</span>`).join("") : n.innerHTML = '<span class="nl-tag" style="color:#8a97a4;border:1px dashed #aaa;background:transparent;">点击选择标签</span>'
        }
        a(), n.addEventListener("click", () => {
            f();
            const e = new Set(d),
                t = s.createElement("div");

            function n() {
                return f().map(t => {
                    const n = e.has(t);
                    return `<div class="nl-tagpicker-item${n?" checked":""}" data-cat="${k(t)}"><div class="nl-tcheck">${n?"✓":""}</div><div class="nl-tname">${k(t)}</div></div>`
                }).join("")
            }
            t.className = "nl-tagpicker", t.innerHTML = `<div class="nl-tagpicker-box"><div class="nl-tagpicker-title">选择预设标签</div><div id="nl-ptaglist">${n()}</div><div class="nl-tagpicker-foot"><button class="nl-btn ghost" id="nl-ptagadd" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">新建标签</button><button class="nl-btn ghost" id="nl-ptagcancel" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">取消</button><button class="nl-btn" id="nl-ptagok" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">确定</button></div></div>`;
            s.getElementById(r).querySelector(".nl-box").appendChild(t), t.addEventListener("click", n => {
                n.target === t && t.remove();
                const r = n.target.closest(".nl-tagpicker-item");
                if (r) {
                    const t = r.getAttribute("data-cat");
                    e.has(t) ? e.delete(t) : e.add(t), r.classList.toggle("checked"), r.querySelector(".nl-tcheck").textContent = e.has(t) ? "✓" : ""
                }
            }), t.querySelector("#nl-ptagadd").addEventListener("click", () => {
                const r = prompt("输入新的标签名称：");
                r && x(r) && (e.add(r.trim()), t.querySelector("#nl-ptaglist").innerHTML = n())
            }), t.querySelector("#nl-ptagcancel").addEventListener("click", () => t.remove()), t.querySelector("#nl-ptagok").addEventListener("click", () => {
                d = Array.from(e).filter(e => e), a(), t.remove()
            })
        });
        const i = e.querySelector("#nl-file"),
            o = e.querySelector("#nl-drop");
        o.addEventListener("click", () => i.click()), i.addEventListener("change", e => {
            e.target.files[0] && H(e.target.files[0])
        }), ["dragenter", "dragover"].forEach(e => o.addEventListener(e, e => {
            e.preventDefault(), o.classList.add("drag")
        })), ["dragleave", "drop"].forEach(e => o.addEventListener(e, e => {
            e.preventDefault(), o.classList.remove("drag")
        })), o.addEventListener("drop", e => {
            const t = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            t && H(t)
        });
        const l = e.querySelector("#nl-directimport");
        l && l.addEventListener("click", () => {
            c = {
                source: "手动导入",
                positive: "",
                negative: "",
                thumb: ""
            }, B()
        }), e.querySelectorAll(".nl-copy").forEach(t => {
            t.addEventListener("click", () => {
                V("pos" === t.getAttribute("data-copy") ? e.querySelector("#nl-pos").value : e.querySelector("#nl-neg").value)
            })
        });
        e.querySelectorAll(".nl-expand").forEach(x => {
            x.addEventListener("click", () => {
                var ta = x.closest(".nl-field").querySelector("textarea");
                if (ta) {
                    var bg = ta.getAttribute("data-big") === "1";
                    ta.style.height = bg ? "" : "50vh";
                    ta.setAttribute("data-big", bg ? "0" : "1")
                }
            })
        });
        const p = e.querySelector("#nl-parse-thumb"),
            u = e.querySelector("#nl-parse-thumbfile");
        p && u && (p.addEventListener("click", () => u.click()), u.addEventListener("change", async e => {
            const t = e.target.files[0];
            if (t) try {
                const e = await C(t);
                c && (c.thumb = e), B()
            } catch (e) {
                E("图片处理失败", "error")
            }
        }));
        (function(){
            var box = e.querySelector("#nl-settings-nai-params"),
                sel = e.querySelector("#nl-set-param-group"),
                fields = e.querySelector("#nl-set-param-fields");
            if (!box || !sel || !fields) return;
            function cur(){ return sel.value || nlGetActiveParamGroup() || NL_DEFAULT_PARAM_GROUP; }
            function keys(){ var gs = nlGetParamGroups(); return Object.keys(gs).sort(function(a,b){ return a===NL_DEFAULT_PARAM_GROUP?-1:b===NL_DEFAULT_PARAM_GROUP?1:a.localeCompare(b,"zh-CN"); }); }
            function refresh(group){
                var gs = nlGetParamGroups(), ks = keys(), cg = group || cur();
                if (!ks.length){ nlEnsureDefaultParamGroup(); gs = nlGetParamGroups(); ks = keys(); }
                if (!gs[cg]) cg = gs[NL_DEFAULT_PARAM_GROUP] ? NL_DEFAULT_PARAM_GROUP : ks[0];
                sel.innerHTML = ks.map(function(g){ return '<option value="'+k(g)+'"'+(g===cg?' selected':'')+'>'+k(g)+'</option>'; }).join("");
                sel.value = cg || "";
                fields.innerHTML = nlRenderParamFieldInputs("nl-set-pf-", gs[cg] && gs[cg].params || nlReadAllNaiParams());
                bindFields();
            }
            function saveApply(ev){
                var cg = cur();
                if (!cg) return;
                ev && ev.target && ev.target.getAttribute("data-pf") === "novelai_size" && nlSyncParamSizeInputs(fields, "nl-set-pf-");
                var params = nlReadParamFieldInputs(fields, "nl-set-pf-");
                nlSaveParamGroup(cg, params);
                nlApplyParamGroup(cg);
            }
            function bindFields(){
                fields.querySelectorAll("[data-pf]").forEach(function(el) {
                    ["input", "change"].forEach(function(ev) {
                        el.addEventListener(ev, saveApply)
                    })
                });
            }
            sel.addEventListener("change", function(){
                refresh(sel.value);
                nlApplyParamGroup(sel.value);
            });
            box.querySelectorAll(".nl-set-param-btn").forEach(function(btn){
                btn.addEventListener("click", function(){
                    var act = btn.getAttribute("data-pa"), cg = cur();
                    if (act === "new") {
                        var nm = prompt("输入新参数组名称：");
                        if (!nm || !(nm = nm.trim())) return;
                        if (nlGetParamGroups()[nm]) return void E("已存在同名参数组", "error");
                        nlCreateParamGroup(nm, nlReadParamFieldInputs(fields, "nl-set-pf-"));
                        refresh(nm); nlApplyParamGroup(nm); E("已创建并启用参数组「"+nm+"」", "success");
                    } else if (act === "rename") {
                        if (!cg) return void E("暂无参数组", "warning");
                        if (cg === NL_DEFAULT_PARAM_GROUP) return void E("默认组不可重命名", "warning");
                        var nn = prompt("重命名参数组「"+cg+"」为：", cg);
                        if (!nn || !(nn = nn.trim()) || nn === cg) return;
                        if (nlGetParamGroups()[nn]) return void E("已存在同名参数组", "error");
                        nlRenameParamGroup(cg, nn) ? (refresh(nn), nlApplyParamGroup(nn), E("已重命名为「"+nn+"」", "success")) : E("重命名失败", "error");
                    } else if (act === "del") {
                        if (!cg) return void E("暂无参数组", "warning");
                        if (cg === NL_DEFAULT_PARAM_GROUP) return void E("默认组不可删除", "warning");
                        if (!confirm("删除参数组「"+cg+"」？")) return;
                        nlDeleteParamGroup(cg) ? (refresh(""), nlApplyParamGroup(cur()), E("已删除参数组「"+cg+"」", "success")) : E("删除失败", "error");
                    }
                })
            });
            bindFields();
        })();
        var ft = e.querySelector("#nl-floating-toggle");
        ft && ft.addEventListener("change", function() {
            nlSetFloatingEnabled(ft.checked)
        });
        const v = e.querySelector("#nl-parse-close");
        v && v.addEventListener("click", () => {
            c = null, d = [], B()
        });
        const b = e.querySelector("#nl-save");
        b && b.addEventListener("click", async () => {
            const t = (e.querySelector("#nl-name").value || "").trim();
            if (!t) return void E("请先给这组提示词起个名字", "warning");
            d.length || (d = ["未分类"]);
            var n = null,
                _allrecs = [];
            try {
                _allrecs = await I.all();
                n = _allrecs.find(e => (e.name || "").trim() === t) || null
            } catch (e) {}
            if (n && !confirm("已存在名为「" + t + "」的预设，继续保存将覆盖它，是否继续？")) return;
            const vibeBinding = getCurrentVibeBinding(),
                _setpc = e.querySelector("#nl-settings-nai-params"),
                naiParams = _setpc ? nlReadParamFieldInputs(_setpc, "nl-set-pf-") : nlGetSettingsNaiParams(e),
                _activeParamGroup = nlGetActiveParamGroup(),
                r = {
                    id: n ? n.id : S(),
                    name: t,
                    category: d.slice(),
                    positive: e.querySelector("#nl-pos").value || "",
                    negative: e.querySelector("#nl-neg").value || "",
                    source: c && c.source || "",
                    thumb: c && c.thumb || n && n.thumb || "",
                    createdAt: n && n.createdAt || Date.now(),
                    sortOrder: n && typeof n.sortOrder === "number" ? n.sortOrder : (_allrecs.reduce((m, x) => typeof x.sortOrder === "number" && x.sortOrder < m ? x.sortOrder : m, 0) - 1),
                    vibeEnabled: vibeBinding.vibeEnabled,
                    vibeGroup: vibeBinding.vibeGroup,
                    vibeStrengths: vibeBinding.vibeStrengths,
                    naiSampler: naiParams.novelai_sampler,
                    naiSteps: naiParams.novelai_steps,
                    naiPromptGuidance: naiParams.nai3Scale,
                    naiPromptGuidanceRescale: naiParams.cfg_rescale,
                    naiParamGroup: n && n.naiParamGroup || NL_DEFAULT_PARAM_GROUP,
                    naiParams: naiParams
                };
            try {
                await I.put(r);
                var a = !1;
                try {
                    W() && (Y(t, r.positive, r.negative), nlApplyPresetParams(r), a = !0)
                } catch (e) {}
                E(a ? n ? "已覆盖并同步智绘姬预设" : "已保存到收藏库并同步为智绘姬预设" : n ? "已覆盖收藏库预设" : "已保存到收藏库", "success"), c = null, d = [], M("lib")
            } catch (e) {
                E("保存失败：" + (e && e.message ? e.message : e), "error")
            }
        })
    }
    async function H(e) {
        E("解析中...", "info");
        try {
            c = await T(e), c.positive || c.negative ? E("解析成功", "success") : E("未在图片中找到提示词元数据", "warning")
        } catch (e) {
            c = null, E("解析失败：" + (e && e.message ? e.message : e), "error")
        }
        B()
    }

    function V(e) {
        try {
            navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(e).then(() => E("已复制", "success"), () => U(e)) : U(e)
        } catch (t) {
            U(e)
        }
    }

    function U(e) {
        try {
            const t = s.createElement("textarea");
            t.value = e, t.style.position = "fixed", t.style.opacity = "0", s.body.appendChild(t), t.select(), s.execCommand("copy"), s.body.removeChild(t), E("已复制", "success")
        } catch (e) {
            E("复制失败", "error")
        }
    }
    var J = !1;
    async function R() {
        const e = s.getElementById(r),
            t = e.querySelector('.nl-body[data-view="lib"]');
        await async function() {
            if (!J) {
                J = !0;
                try {
                    var e = W();
                    if (!e || !e.yushe) return;
                    var t = Object.keys(e.yushe);
                    if (!t.length) return;
                    var n = [];
                    try {
                        n = await I.all()
                    } catch (e) {
                        n = []
                    }
                    for (var r = {}, a = 0; a < n.length; a++) {
                        var i = n[a],
                            o = (i.name || "").trim();
                        if (r[o]) try {
                            await I.del(i.id)
                        } catch (e) {} else r[o] = i
                    }
                    for (var l = f(), s = "智绘姬预设", c = y(), d = !1, p = 0; p < t.length; p++) {
                        var u = t[p],
                            v = (u || "").trim();
                        if (!(c.indexOf(v) >= 0)) {
                            var b = e.yushe[u] || {},
                                g = b.fixedPrompt || "";
                            b.fixedPrompt_end && (g = g ? g + ", " + b.fixedPrompt_end : b.fixedPrompt_end);
                            var x = b.negativePrompt || "",
                                h = r[v];
                            if (h) {
                                if (h.positive !== g || h.negative !== x) {
                                    h.positive = g, h.negative = x;
                                    try {
                                        await I.put(h)
                                    } catch (e) {}
                                }
                            } else {
                                var w = {
                                    id: S(),
                                    name: u,
                                    category: [s],
                                    positive: g,
                                    negative: x,
                                    source: "智绘姬",
                                    thumb: "",
                                    createdAt: Date.now()
                                };
                                try {
                                    await I.put(w), r[v] = w
                                } catch (e) {}!d && l.indexOf(s) < 0 && (l.push(s), m(l), d = !0)
                            }
                        }
                    }
                } catch (e) {} finally {
                    J = !1
                }
            }
        }();
        let n = [];
        try {
            n = await I.all()
        } catch (e) {
            n = []
        }
        var a = "";
        try {
            var i = W();
            i && (a = i.yusheid_novelai || "")
        } catch (e) {}
        n.sort((e, t) => {
            var ec = e.name === a,
                tc = t.name === a;
            if (ec && !tc) return -1;
            if (tc && !ec) return 1;
            var eo = typeof e.sortOrder === "number",
                to = typeof t.sortOrder === "number";
            if (eo && to) return e.sortOrder - t.sortOrder;
            if (eo) return -1;
            if (to) return 1;
            return (t.createdAt || 0) - (e.createdAt || 0)
        });
        const o = f(),
            l = {};
        n.forEach(e => {
            h(e).forEach(e => {
                l[e] = !0
            })
        });
        const c = ["__all__"].concat(o.filter(e => l[e]));
        Object.keys(l).forEach(e => {
            c.indexOf(e) < 0 && c.push(e)
        });
        const d = "__all__" === p ? n : n.filter(e => h(e).includes(p)),
            $ = u.trim().toLowerCase(),
            L = $ ? d.filter(e => (e.name || "").toLowerCase().includes($)) : d,
            j = c.map(e => {
                const t = "__all__" === e ? "全部" : e;
                return `<span class="nl-chip${e===p?" active":""}" data-fcat="${k(e)}">${k(t)}</span>`
            }).join("") + '<span class="nl-chip" id="nl-addcat-chip" data-fcat="__addnew__" style="font-size:14px;cursor:pointer;">+</span>';
        let q;
        q = L.length ? `<div class="nl-grid${"list"===v?" list-mode":""}">` + L.map(e => {
            const t = e.thumb ? `<img class="nl-thumb" draggable="false" oncontextmenu="return false" src="${e.thumb}" decoding="async" loading="lazy">` : '<div class="nl-thumb empty">&#128247;</div>';
            return `<div oncontextmenu="return false" class="nl-card${e.name===a?" is-current":""}${b&&g.has(e.id)?" selected":""}" data-id="${e.id}">${t}<div class="nl-cardinfo"><div class="nl-cardname">${k(e.name||"未命名")}</div><div class="nl-tags">${h(e).map(e=>`<span class="nl-tag">${k(e)}</span>`).join("")}</div></div>\n</div>`
        }).join("") + "</div>" : '<div class="nl-empty">还没有收藏，去"导入预设"标签添加吧</div>', t.innerHTML = `\n<div style="margin-bottom:10px;"><div class="nl-chips" id="nl-filter">${j}</div>\n</div>\n<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;"><div class="nl-search-wrap"><input type="text" class="nl-search" id="nl-search-input" placeholder="搜索预设名称..." value="${k(u)}"></div><span class="nl-viewtoggle" id="nl-viewtoggle" title="${"grid"===v?"列表视图":"网格视图"}">${"grid"===v?"☰":"☷"}</span><span class="nl-viewtoggle" id="nl-randpick" title="随机抽取">⚄</span><span class="nl-viewtoggle" id="nl-multisel-btn" title="多选" style="${b?"background:var(--nl-accent);color:#fff;border-color:var(--nl-accent);":""}">${b?"✕":"☑"}</span>\n</div>\n${b?'<div class="nl-multibar" id="nl-multibar"><span style="font-size:13px;color:#566472;" id="nl-selcount">已选 0 项</span><button class="nl-btn ghost" id="nl-sel-all" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">全选</button><button class="nl-btn ghost" id="nl-sel-tag" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">改标签</button><button class="nl-btn ghost" id="nl-sel-auto" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">自动分类</button><button class="nl-btn danger" id="nl-sel-del" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">删除</button></div>':""}\n${q}`, t.querySelectorAll(".nl-chip[data-fcat]").forEach(e => {
            e.addEventListener("click", () => {
                const t = e.getAttribute("data-fcat");
                if ("__addnew__" === t) {
                    const e = prompt("输入新的标签名称：");
                    return void(e && x(e) && (E("已添加标签：" + e.trim(), "success"), R()))
                }
                p = t, R()
            })
        });
        var _ = t.querySelector("#nl-viewtoggle");
        _ && _.addEventListener("click", () => {
            v = "grid" === v ? "list" : "grid", R()
        });
        var RB = t.querySelector('#nl-randpick');
        RB && RB.addEventListener('click', function() {
            var host = s.getElementById(r);
            if (!host) return;
            var ex = host.querySelector('#nl-randmask');
            if (ex) ex.remove();
            var picks = [],
                sel = null;
            var mask = s.createElement('div');
            mask.id = 'nl-randmask';
            mask.setAttribute('style', 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(20,24,30,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);');

            function sample() {
                var arr = d.slice();
                if (!arr.length) return [];
                var out = [],
                    pool = arr.slice();
                for (var i = 0; i < 6; i++) {
                    if (!pool.length) pool = arr.slice();
                    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
                }
                return out;
            }

            function render() {
                picks = sample();
                sel = null;
                if (!picks.length) {
                    mask.innerHTML = '<div style="background:rgba(255,255,255,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.6);border-radius:18px;padding:26px;color:#2a3640;font-size:14px;text-align:center;box-shadow:0 18px 50px rgba(40,55,70,.28);">\u5f53\u524d\u5206\u7c7b\u6ca1\u6709\u53ef\u62bd\u53d6\u7684\u9884\u8bbe<div style="margin-top:16px;"><button class="nl-btn ghost" id="nl-rand-cancel" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">\u5173\u95ed</button></div></div>';
                    var cc = mask.querySelector('#nl-rand-cancel');
                    cc && cc.addEventListener('click', function() {
                        mask.remove();
                    });
                    return;
                }
                var cards = picks.map(function(e, idx) {
                    var thumb = e.thumb ? '<img src="' + e.thumb + '" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">' : '<div style="font-size:30px;color:#b3bcc6;">\u2605</div>';
                    return '<div class="nl-rcard" data-ri="' + idx + '" style="position:relative;aspect-ratio:3/4;border-radius:14px;cursor:pointer;overflow:hidden;box-shadow:0 6px 18px rgba(40,55,70,.22);transition:transform .3s,opacity .3s;transform-origin:center center;"><div class="nl-rback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#e6f2ff;border:1px solid rgba(150,180,210,.45);"><span style="font-size:46px;color:#8fb3d9;text-shadow:0 2px 10px rgba(120,160,200,.45);line-height:1;">\u2736</span></div><div class="nl-rfront" style="position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,.95);padding:7px;"><div style="width:100%;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:10px;">' + thumb + '</div><div style="font-size:12px;color:#2a3640;margin-top:6px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">' + k(e.name || '\u672a\u547d\u540d') + '</div></div></div>';
                }).join('');
                mask.innerHTML = '<div class="nl-rwrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:min(380px,82vw);"><div class="nl-rgrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;">' + cards + '</div></div>';
                mask.querySelectorAll('.nl-rcard').forEach(function(cd) {
                    cd.addEventListener('click', function() {
                        reveal(+cd.getAttribute('data-ri'), cd);
                    });
                });
            }

            function reveal(ri, cd) {
                if (sel !== null) return;
                sel = ri;
                var back = cd.querySelector('.nl-rback'),
                    front = cd.querySelector('.nl-rfront');
                mask.querySelectorAll('.nl-rcard').forEach(function(o) {
                    if (o !== cd) {
                        o.style.opacity = '0';
                        o.style.transform = 'scale(.4)';
                        o.style.pointerEvents = 'none';
                    }
                });
                cd.style.zIndex = '5';
                cd.style.transition = 'transform .25s';
                cd.style.transform = 'rotateY(90deg)';
                setTimeout(function() {
                    back.style.display = 'none';
                    front.style.display = 'flex';
                    cd.style.transform = 'rotateY(0deg)';
                }, 250);
                setTimeout(function() {
                    mask.querySelectorAll('.nl-rcard').forEach(function(o) {
                        if (o !== cd) o.style.display = 'none';
                    });
                    var grid = mask.querySelector('.nl-rgrid');
                    if (grid) {
                        grid.style.gridTemplateColumns = '1fr';
                        grid.style.maxWidth = '180px';
                        grid.style.margin = '0 auto';
                    }
                    cd.style.transition = 'transform .3s';
                    cd.style.transform = 'none';
                    showBtns();
                }, 430);
            }

            function showBtns() {
                var wrap = mask.querySelector('.nl-rwrap');
                if (!wrap || wrap.querySelector('#nl-rand-btns')) return;
                var bar = s.createElement('div');
                bar.id = 'nl-rand-btns';
                bar.setAttribute('style', 'margin-top:22px;display:flex;gap:10px;justify-content:center;white-space:nowrap;opacity:0;transition:opacity .3s;');
                bar.innerHTML = '<button class="nl-btn ghost" id="nl-rand-cancel" style="font-size:14px!important;padding:9px 14px!important;min-height:40px!important;line-height:1.2!important;box-sizing:border-box!important;">\u53d6\u6d88</button><button class="nl-btn ghost" id="nl-rand-reroll" style="font-size:14px!important;padding:9px 14px!important;min-height:40px!important;line-height:1.2!important;box-sizing:border-box!important;">\u91cd\u65b0\u62bd\u53d6</button><button class="nl-btn" id="nl-rand-apply" style="font-size:14px!important;padding:9px 14px!important;min-height:40px!important;line-height:1.2!important;box-sizing:border-box!important;">\u8bbe\u4e3a\u9884\u8bbe</button>';
                wrap.appendChild(bar);
                requestAnimationFrame(function() {
                    bar.style.opacity = '1';
                });
                var c1 = bar.querySelector('#nl-rand-cancel');
                c1 && c1.addEventListener('click', function() {
                    mask.remove();
                });
                var c2 = bar.querySelector('#nl-rand-reroll');
                c2 && c2.addEventListener('click', function() {
                    render();
                });
                var c3 = bar.querySelector('#nl-rand-apply');
                c3 && c3.addEventListener('click', function() {
                    var e = picks[sel];
                    mask.remove();
                    applyPresetEntry(e);
                    setTimeout(R, 300);
                });
            }
            mask.addEventListener('click', function(ev) {
                if (ev.target === mask) mask.remove();
            });
            host.appendChild(mask);
            render();
        });
        const A = t.querySelector("#nl-search-input");
        A && A.addEventListener("input", e => {
            u = e.target.value, R();
            var t = document.getElementById("nl-search-input");
            t && (t.focus(), t.selectionStart = t.selectionEnd = t.value.length)
        }), t.querySelectorAll(".nl-card").forEach(e => {
            e.addEventListener("click", () => {
                const n = e.getAttribute("data-id");
                if (t._nlDragSuppress) return;
                if (b) {
                    g.has(n) ? g.delete(n) : g.add(n), e.classList.toggle("selected");
                    var r = t.querySelector("#nl-selcount");
                    r && (r.textContent = "已选 " + g.size + " 项")
                } else {
                    if (e._nlClickT) {
                        clearTimeout(e._nlClickT);
                        e._nlClickT = null;
                        return
                    }
                    e._nlClickT = setTimeout(function() {
                        e._nlClickT = null;
                        Q(n)
                    }, 260)
                }
            });
            e.addEventListener("dblclick", async () => {
                if (b) return;
                if (e._nlClickT) {
                    clearTimeout(e._nlClickT);
                    e._nlClickT = null
                }
                const id = e.getAttribute("data-id");
                try {
                    var ent = await I.get(id);
                    if (ent) applyPresetEntry(ent)
                } catch (err) {}
            })
        });
        (function() {
            if (b) return;
            if (p !== "__all__" || u.trim()) return;
            var cont = t,
                pressT = null,
                drag = null,
                sx = 0,
                sy = 0,
                gx = 0,
                gy = 0,
                bx = 0,
                by = 0,
                lastSwap = 0;

            function tmH(ev) {
                if (drag) ev.preventDefault();
            }

            function clearP() {
                if (pressT) {
                    clearTimeout(pressT);
                    pressT = null;
                }
            }

            function snap() {
                var m = {};
                cont.querySelectorAll(".nl-card").forEach(function(x) {
                    if (x !== drag) m[x.getAttribute("data-id")] = x.getBoundingClientRect();
                });
                return m;
            }

            function flip(prev) {
                cont.querySelectorAll(".nl-card").forEach(function(x) {
                    if (x === drag) return;
                    var o = prev[x.getAttribute("data-id")];
                    if (!o) return;
                    var n = x.getBoundingClientRect(),
                        dx = o.left - n.left,
                        dy = o.top - n.top;
                    if (dx || dy) {
                        x.style.transition = "none";
                        x.style.transform = "translate(" + dx + "px," + dy + "px)";
                        x.getBoundingClientRect();
                        x.style.transition = "transform .2s cubic-bezier(.2,0,0,1)";
                        x.style.transform = "";
                    }
                });
            }

            function endFn() {
                clearP();
                if (!drag) return;
                var d = drag;
                drag = null;
                cont.style.touchAction = "";
                try {
                    cont.removeEventListener("touchmove", tmH, {
                        passive: false
                    });
                } catch (e) {}
                d.style.transition = "transform .2s cubic-bezier(.2,0,0,1)";
                d.style.transform = "";
                d.style.opacity = "";
                d.style.boxShadow = "";
                d.style.zIndex = "";
                d.style.touchAction = "";
                d.classList.remove("nl-dragging");
                setTimeout(function() {
                    d.style.transition = "";
                }, 230);
                cont._nlDragSuppress = true;
                setTimeout(function() {
                    cont._nlDragSuppress = false;
                }, 350);
                var ids = [];
                cont.querySelectorAll(".nl-card").forEach(function(x) {
                    ids.push(x.getAttribute("data-id"));
                });
                (async function() {
                    try {
                        var all = await I.all(),
                            mp = {};
                        all.forEach(function(x) {
                            mp[x.id] = x;
                        });
                        for (var i = 0; i < ids.length; i++) {
                            var it = mp[ids[i]];
                            if (it) {
                                it.sortOrder = i;
                                try {
                                    await I.put(it);
                                } catch (e) {}
                            }
                        }
                    } catch (e) {}
                    R();
                })();
            }
            cont.querySelectorAll(".nl-card").forEach(function(card) {
                card.addEventListener("pointerdown", function(ev) {
                    if (ev.target && ev.target.tagName && "img" === ev.target.tagName.toLowerCase()) ev.preventDefault();
                    if (b) return;
                    sx = ev.clientX;
                    sy = ev.clientY;
                    clearP();
                    pressT = setTimeout(function() {
                        pressT = null;
                        drag = card;
                        cont.style.touchAction = "none";
                        try {
                            cont.addEventListener("touchmove", tmH, {
                                passive: false
                            });
                        } catch (e) {}
                        var rc = card.getBoundingClientRect();
                        bx = rc.left;
                        by = rc.top;
                        gx = sx - rc.left;
                        gy = sy - rc.top;
                        card.classList.add("nl-dragging");
                        card.style.transition = "none";
                        card.style.opacity = "0.96";
                        card.style.boxShadow = "0 8px 22px rgba(0,0,0,.3)";
                        card.style.zIndex = "50";
                        card.style.transform = "scale(1.05)";
                        try {
                            card.setPointerCapture(ev.pointerId);
                        } catch (e) {}
                        if (navigator.vibrate) try {
                            navigator.vibrate(15);
                        } catch (e) {}
                    }, 450);
                });
                card.addEventListener("pointermove", function(ev) {
                    if (pressT) {
                        if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) clearP();
                        return;
                    }
                    if (!drag) return;
                    ev.preventDefault();
                    var tx = (ev.clientX - gx) - bx,
                        ty = (ev.clientY - gy) - by;
                    drag.style.transform = "translate(" + tx + "px," + ty + "px) scale(1.05)";
                    var now = Date.now();
                    if (now - lastSwap < 50) return;
                    var els = cont.querySelectorAll(".nl-card"),
                        tg = null;
                    for (var i = 0; i < els.length; i++) {
                        var cc = els[i];
                        if (cc === drag) continue;
                        var rc = cc.getBoundingClientRect();
                        if (ev.clientX >= rc.left && ev.clientX <= rc.right && ev.clientY >= rc.top && ev.clientY <= rc.bottom) {
                            tg = cc;
                            break;
                        }
                    }
                    if (tg) {
                        var prev = snap();
                        var rc2 = tg.getBoundingClientRect(),
                            after = (ev.clientY - rc2.top) > rc2.height / 2,
                            par = drag.parentNode,
                            b0 = drag.getBoundingClientRect();
                        if (after) par.insertBefore(drag, tg.nextSibling);
                        else par.insertBefore(drag, tg);
                        var b1 = drag.getBoundingClientRect();
                        bx += b1.left - b0.left;
                        by += b1.top - b0.top;
                        drag.style.transform = "translate(" + ((ev.clientX - gx) - bx) + "px," + ((ev.clientY - gy) - by) + "px) scale(1.05)";
                        lastSwap = now;
                        flip(prev);
                    }
                });
                card.addEventListener("pointerup", endFn);
                card.addEventListener("pointercancel", endFn);
            });
        })();
        var D = t.querySelector("#nl-multisel-btn");
        if (D && D.addEventListener("click", () => {
                b = !b, g.clear(), R()
            }), b) {
            var z = t.querySelector("#nl-sel-all");
            z && z.addEventListener("click", () => {
                L.forEach(e => g.add(e.id));
                t.querySelectorAll(".nl-card").forEach(e => e.classList.add("selected"));
                var r = t.querySelector("#nl-selcount");
                r && (r.textContent = "已选 " + g.size + " 项")
            });
            var Au = t.querySelector("#nl-sel-auto");
            Au && Au.addEventListener("click", async () => {
                if (!g.size) return void E("请先选择预设", "warning");
                var cnt = 0;
                for (const id of g) {
                    try {
                        var ent = await I.get(id);
                        if (ent) {
                            var cats = autoClassify(ent.positive || "", ent.negative || "");
                            cats.forEach(function(cc) {
                                x(cc)
                            });
                            ent.category = cats;
                            await I.put(ent);
                            cnt++
                        }
                    } catch (e) {}
                }
                E("已自动分类 " + cnt + " 个预设", "success"), R()
            });
            var P = t.querySelector("#nl-sel-del");
            P && P.addEventListener("click", async () => {
                if (g.size) {
                    if (confirm("确定删除选中的 " + g.size + " 个预设？")) {
                        for (const a of g) try {
                            var e = await I.get(a);
                            if (await I.del(a), e) {
                                w(e.name);
                                try {
                                    var t = W();
                                    t && t.yushe && t.yushe[e.name] && delete t.yushe[e.name], t && t.yusheid_novelai === e.name && (t.yusheid_novelai = "")
                                } catch (e) {}
                                try {
                                    var n = (window.parent && window.parent.document || document).getElementById("yusheid_novelai");
                                    if (n) {
                                        var r = Array.from(n.options).find(t => t.value === e.name);
                                        r && r.remove(), n.value === e.name && (n.value = "")
                                    }
                                } catch (e) {}
                            }
                        } catch (e) {}
                        try {
                            X()
                        } catch (e) {}
                        try {
                            var a = (window.parent && window.parent.document || document).getElementById("yusheid_novelai");
                            if (a) {
                                var i = window.parent && (window.parent.jQuery || window.parent.$);
                                i && i(a).trigger("change")
                            }
                        } catch (e) {}
                        g.clear(), b = !1, E("已删除", "success"), R()
                    }
                } else E("请先选择预设", "warning")
            });
            var O = t.querySelector("#nl-sel-tag");
            O && O.addEventListener("click", () => {
                if (!g.size) return void E("请先选择预设", "warning");
                const t = s.createElement("div");

                function n(n) {
                    t.remove();
                    const r = new Set,
                        a = s.createElement("div");

                    function i() {
                        return f().map(e => {
                            const t = r.has(e);
                            return `<div class="nl-tagpicker-item${t?" checked":""}" data-cat="${k(e)}"><div class="nl-tcheck">${t?"✓":""}</div><div class="nl-tname">${k(e)}</div></div>`
                        }).join("")
                    }
                    a.className = "nl-tagpicker";
                    const o = "replace" === n ? "覆盖标签 — 选择新标签" : "新增标签 — 选择要追加的标签";
                    a.innerHTML = `<div class="nl-tagpicker-box"><div class="nl-tagpicker-title">${o}</div><div id="nl-mtaglist">${i()}</div><div class="nl-tagpicker-foot"><button class="nl-btn ghost" id="nl-mtagadd" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">+ 新建</button><button class="nl-btn ghost" id="nl-mtagcancel" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">取消</button><button class="nl-btn" id="nl-mtagok" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">确定</button></div></div>`, e.querySelector(".nl-box").appendChild(a), a.addEventListener("click", e => {
                        e.target === a && a.remove();
                        const t = e.target.closest(".nl-tagpicker-item");
                        if (t) {
                            const e = t.getAttribute("data-cat");
                            r.has(e) ? r.delete(e) : r.add(e), t.classList.toggle("checked"), t.querySelector(".nl-tcheck").textContent = r.has(e) ? "✓" : ""
                        }
                    }), a.querySelector("#nl-mtagadd").addEventListener("click", () => {
                        const e = prompt("输入新的标签名称：");
                        e && x(e) && (r.add(e.trim()), a.querySelector("#nl-mtaglist").innerHTML = i())
                    }), a.querySelector("#nl-mtagcancel").addEventListener("click", () => a.remove()), a.querySelector("#nl-mtagok").addEventListener("click", async () => {
                        const e = Array.from(r).filter(e => e);
                        if (e.length) {
                            for (const r of g) try {
                                var t = await I.get(r);
                                if ("replace" === n) t.category = e.slice();
                                else {
                                    var i = h(t).slice();
                                    e.forEach(e => {
                                        i.indexOf(e) < 0 && i.push(e)
                                    }), t.category = i
                                }
                                await I.put(t)
                            } catch (e) {}
                            a.remove(), g.clear(), b = !1, E("replace" === n ? "已覆盖标签" : "已新增标签", "success"), R()
                        } else E("请至少选择一个标签", "warning")
                    })
                }
                t.className = "nl-tagpicker", t.innerHTML = '<div class="nl-tagpicker-box"><div class="nl-tagpicker-title">选择标签操作方式</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;"><button class="nl-btn" id="nl-tagmode-replace" style="flex:1;font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">覆盖原有标签</button><button class="nl-btn ghost" id="nl-tagmode-append" style="flex:1;font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">新增标签</button><button class="nl-btn ghost" id="nl-tagmode-cancel" style="flex:1;margin-top:4px;font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">取消</button></div></div>', e.querySelector(".nl-box").appendChild(t), t.addEventListener("click", e => {
                    e.target === t && t.remove()
                }), t.querySelector("#nl-tagmode-cancel").addEventListener("click", () => t.remove()), t.querySelector("#nl-tagmode-replace").addEventListener("click", () => n("replace")), t.querySelector("#nl-tagmode-append").addEventListener("click", () => n("append"))
            })
        }
    }
    async function Q(e) {
        const t = s.getElementById(r);
        let n;
        try {
            n = await I.get(e)
        } catch (e) {}
        if (!n) return void E("记录不存在", "error");
        const a = t.querySelector(".nl-detail");
        a && a.remove();
        const i = s.createElement("div");
        i.className = "nl-detail", i.innerHTML = `\n<div class="nl-dbox">${n.thumb?`<img class="nl-dimg" id="nl-dthumbimg" src="${n.thumb}" style="cursor:zoom-in;" title="单击查看大图，双击更换预览图">`:'<div class="nl-thumb empty" id="nl-dthumbimg" style="cursor:zoom-in;height:120px;display:flex;align-items:center;justify-content:center;pointer-events:auto;">单击查看大图，双击更换预览图</div>'}<input type="file" id="nl-dthumbfile" accept="image/*" style="position:absolute;width:0;height:0;overflow:hidden;opacity:0;"><div class="nl-field"><div class="nl-label"><span>名称</span></div><input class="nl-input" id="nl-dname" value="${k(n.name||"未命名")}" style="font-size:15px;font-weight:600;"></div><div class="nl-field"><div class="nl-label"><span>预设标签</span></div><div class="nl-tagdropdown" id="nl-detail-tags">${h(n).map(e=>`<span class="nl-tag">${k(e)}</span>`).join("")||'<span class="nl-placeholder">点击选择标签</span>'}</div></div><div class="nl-field"><div class="nl-label"><span>正面提示词</span><span class="nl-acts" style="display:inline-flex;align-items:center;gap:9px;"><span class="nl-copy" data-copy="pos" style="cursor:pointer;color:#7a8794;font-size:14px;line-height:1;" title="复制">⧉</span><span class="nl-expand" data-exp="pos" style="cursor:pointer;color:#7a8794;font-size:18px;line-height:1;" title="展开">⤢</span></span></div><textarea class="nl-ta" id="nl-dpos">${k(n.positive||"")}</textarea></div><div class="nl-field"><div class="nl-label"><span>负面提示词</span><span class="nl-acts" style="display:inline-flex;align-items:center;gap:9px;"><span class="nl-copy" data-copy="neg" style="cursor:pointer;color:#7a8794;font-size:14px;line-height:1;" title="复制">⧉</span><span class="nl-expand" data-exp="neg" style="cursor:pointer;color:#7a8794;font-size:18px;line-height:1;" title="展开">⤢</span></span></div><textarea class="nl-ta" id="nl-dneg">${k(n.negative||"")}</textarea></div><div class="nl-field"><details class="nl-dvibe-details" style="border:1px solid rgba(120,140,160,.25);border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.5);"><summary style="cursor:pointer;font-size:13px;color:#566472;font-weight:600;outline:none;">Vibe 叠加组</summary><div style="display:flex;align-items:center;gap:10px;margin:8px 0;"><select class="nl-input" id="nl-dvibe-group"${n.vibeEnabled?"":" disabled"} style="flex:1;margin:0;"></select><label class="nl-vibe-toggle" style="display:inline-flex;align-items:center;white-space:nowrap;margin:0;"><input type="checkbox" id="nl-dvibe-enable"${n.vibeEnabled?" checked":""}> 启用</label></div><div class="nl-dvibe-slots" id="nl-dvibe-slots"></div></details></div><div class="nl-field"><details class="nl-dparam-details" style="border:1px solid rgba(120,140,160,.25);border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.5);"><summary style="cursor:pointer;font-size:13px;color:#566472;font-weight:600;outline:none;">智绘姬参数</summary><div style="display:flex;align-items:center;gap:8px;margin:8px 0;"><select class="nl-input" id="nl-dparam-group" style="flex:1;margin:0;"></select></div><div class="nl-dparam-fields" id="nl-dparam-fields" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;"></div></details></div><div class="nl-btnrow"><button class="nl-btn danger" id="nl-del" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">删除</button><button class="nl-btn" id="nl-applychatu" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">设为当前预设</button></div><div class="nl-btnrow"><button class="nl-btn ghost" id="nl-dclose" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">关闭</button></div>\n</div>`, t.querySelector(".nl-box").appendChild(i), i.addEventListener("click", e => {
            e.target === i && i.remove()
        }), i.querySelector("#nl-dclose").addEventListener("click", () => i.remove()), i.querySelectorAll(".nl-copy").forEach(e => {
            e.addEventListener("click", () => {
                V(("pos" === e.getAttribute("data-copy") ? n.positive : n.negative) || "")
            })
        });
        i.querySelectorAll(".nl-expand").forEach(x => {
            x.addEventListener("click", () => {
                var ta = x.closest(".nl-field").querySelector("textarea");
                if (ta) {
                    var bg = ta.getAttribute("data-big") === "1";
                    ta.style.height = bg ? "" : "50vh";
                    ta.setAttribute("data-big", bg ? "0" : "1")
                }
            })
        });
        const o = i.querySelector("#nl-dname");
        o && o.addEventListener("blur", async () => {
            const e = (o.value || "").trim();
            if (e && e !== n.name) {
                var t = null;
                try {
                    t = (await I.all()).find(t => t.id !== n.id && (t.name || "").trim() === e) || null
                } catch (e) {}
                if (t) return E("已存在同名预设，请换个名字", "warning"), void(o.value = n.name);
                const l = n.name;
                n.name = e, await I.put(n);
                try {
                    var r = W();
                    r && r.yushe && r.yushe[l] && (r.yushe[e] = r.yushe[l], delete r.yushe[l]), r && r.yusheid_novelai === l && (r.yusheid_novelai = e), X()
                } catch (e) {}
                try {
                    var a = (window.parent && window.parent.document || document).getElementById("yusheid_novelai");
                    if (a) {
                        var i = Array.from(a.options).find(e => e.value === l);
                        i && (i.value = e, i.textContent = e)
                    }
                } catch (e) {}
                E("名称已更新", "success"), R()
            }
        });
        const l = i.querySelector("#nl-detail-tags");
        l && l.addEventListener("click", () => function(e, t) {
            f();
            const n = new Set(h(e)),
                a = s.createElement("div");

            function i() {
                return f().map(e => {
                    const t = n.has(e);
                    return `<div class="nl-tagpicker-item${t?" checked":""}" data-cat="${k(e)}"><div class="nl-tcheck">${t?"✓":""}</div><div class="nl-tname">${k(e)}</div></div>`
                }).join("")
            }
            a.className = "nl-tagpicker", a.innerHTML = `<div class="nl-tagpicker-box"><div class="nl-tagpicker-title">选择预设标签</div><div id="nl-taglist">${i()}</div><div class="nl-tagpicker-foot"><button class="nl-btn ghost" id="nl-tagadd" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">新建标签</button><button class="nl-btn ghost" id="nl-tagcancel" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">取消</button><button class="nl-btn" id="nl-tagok" style="font-size:12px!important;padding:6px 7px!important;min-height:30px!important;line-height:1.1!important;box-sizing:border-box!important;">确定</button></div></div>`, s.getElementById(r).querySelector(".nl-box").appendChild(a), a.addEventListener("click", e => {
                e.target === a && a.remove();
                const t = e.target.closest(".nl-tagpicker-item");
                if (t) {
                    const e = t.getAttribute("data-cat");
                    n.has(e) ? n.delete(e) : n.add(e), t.classList.toggle("checked"), t.querySelector(".nl-tcheck").textContent = n.has(e) ? "✓" : ""
                }
            }), a.querySelector("#nl-tagadd").addEventListener("click", () => {
                const e = prompt("输入新的标签名称：");
                e && x(e) && (n.add(e.trim()), a.querySelector("#nl-taglist").innerHTML = i())
            }), a.querySelector("#nl-tagcancel").addEventListener("click", () => a.remove()), a.querySelector("#nl-tagok").addEventListener("click", async () => {
                const r = Array.from(n).filter(e => e);
                e.category = r.length ? r : ["未分类"], await I.put(e), E("标签已更新", "success"), a.remove();
                var i = t.querySelector("#nl-detail-tags");
                i && (i.innerHTML = h(e).map(e => `<span class="nl-tag">${k(e)}</span>`).join("") || '<span class="nl-placeholder">点击选择标签</span>'), R()
            })
        }(n, i));
        const c = i.querySelector("#nl-dpos"),
            d = i.querySelector("#nl-dneg");
        async function p() {
            let e = !1;
            const t = c ? c.value : n.positive,
                r = d ? d.value : n.negative;
            t !== n.positive && (n.positive = t, e = !0), r !== n.negative && (n.negative = r, e = !0);
            if (e) {
                await I.put(n);
                try {
                    var nm = (n.name || "").trim(),
                        st = W();
                    if (nm && st && st.yushe && st.yushe[nm]) {
                        st.yushe[nm].fixedPrompt = n.positive || "", st.yushe[nm].negativePrompt = n.negative || "";
                        X();
                        if (st.yusheid_novelai === nm) {
                            nlApplyPresetParams(n);
                            var pd = window.parent && window.parent.document || document,
                                jq = window.parent && (window.parent.jQuery || window.parent.$);
                            [{
                                id: "fixedPrompt_novelai",
                                val: n.positive || ""
                            }, {
                                id: "negativePrompt_novelai",
                                val: n.negative || ""
                            }].forEach(function(o) {
                                var el = pd.getElementById(o.id);
                                el && (el.value = o.val, jq ? jq(el).val(o.val).trigger("input").trigger("change") : (el.dispatchEvent(new Event("input", {
                                    bubbles: !0
                                })), el.dispatchEvent(new Event("change", {
                                    bubbles: !0
                                }))))
                            })
                        }
                    }
                } catch (e) {}
                E("提示词已保存", "success")
            }
        }
        c && c.addEventListener("blur", p), d && d.addEventListener("blur", p);
        const u = i.querySelector("#nl-applychatu"),
            v = i.querySelector("#nl-dvibe-enable"),
            b = i.querySelector("#nl-dvibe-group"),
            g = i.querySelector("#nl-dvibe-slots");

        function m() {
            if (g)
                if (n.vibeEnabled && n.vibeGroup) {
                    var e = (re() || {})[n.vibeGroup],
                        t = e && e.vibes || [],
                        r = K();
                    t.length ? (n.vibeStrengths || (n.vibeStrengths = {}), g.innerHTML = t.map(function(e) {
                        var t = r.filter(function(t) {
                                return t.vibeDataId === e.vibeDataId
                            })[0],
                            a = t ? t.name : "（未知）" + (e.vibeDataId || "").slice(0, 8),
                            i = t && t.thumb ? '<img class="nl-vibe-slot-thumb" draggable="false" oncontextmenu="return false" src="' + t.thumb + '">' : '<div class="nl-vibe-slot-thumb empty">&#127912;</div>',
                            o = "number" == typeof n.vibeStrengths[e.vibeDataId] ? n.vibeStrengths[e.vibeDataId] : "number" == typeof e.strength ? e.strength : .6;
                        return '<div class="nl-vibe-slot" data-vid="' + k(e.vibeDataId) + '">' + i + '<div class="nl-vibe-slot-body"><div class="nl-vibe-slot-name">' + k(a) + '</div><label class="nl-vibe-row"><span>强度 <b class="nl-slot-strv">' + o.toFixed(2) + '</b></span><input type="range" class="nl-dslot-strength" data-vid="' + k(e.vibeDataId) + '" min="0" max="1" step="0.01" value="' + o + '"></label></div></div>'
                    }).join(""), g.querySelectorAll(".nl-dslot-strength").forEach(function(e) {
                        e.addEventListener("input", function() {
                            var t = e.getAttribute("data-vid"),
                                r = parseFloat(e.value);
                            n.vibeStrengths[t] = r;
                            var a = e.parentNode.querySelector(".nl-slot-strv");
                            a && (a.textContent = r.toFixed(2)), y && clearTimeout(y), y = setTimeout(function() {
                                I.put(n);
                                try {
                                    var st = W();
                                    if (st && (st.yusheid_novelai || "") === (n.name || "").trim() && n.vibeEnabled && n.vibeGroup && st.vibeGroups && st.vibeGroups[n.vibeGroup]) {
                                        var grp = st.vibeGroups[n.vibeGroup],
                                            vs = n.vibeStrengths || {};
                                        grp.vibes && grp.vibes.forEach(function(it) {
                                            "number" == typeof vs[it.vibeDataId] && (it.strength = vs[it.vibeDataId])
                                        });
                                        ie(n.vibeGroup)
                                    }
                                } catch (e) {}
                            }, 400)
                        })
                    })) : g.innerHTML = '<div class="nl-empty" style="padding:10px;font-size:12px;">该组为空</div>'
                } else g.innerHTML = ""
        }
        var y = null;
        v && v.addEventListener("change", async function() {
                n.vibeEnabled = v.checked, b && (b.disabled = !n.vibeEnabled), n.vibeEnabled && !n.vibeGroup && b && b.value && (n.vibeGroup = b.value), await I.put(n), oeSyncEnabled(n.vibeEnabled), n.vibeEnabled && n.vibeGroup && ie(n.vibeGroup), m()
            }), b && b.addEventListener("change", async function() {
                n.vibeGroup = b.value, n.vibeStrengths = {}, await I.put(n), n.vibeEnabled && (oeSyncEnabled(!0), ie(n.vibeGroup)), m()
            }),
            function() {
                if (b) {
                    var e = re() || {},
                        t = Object.keys(e).sort(function(e, t) {
                            return "默认组" === e ? -1 : "默认组" === t ? 1 : e.localeCompare(t, "zh-CN")
                        });
                    t.length ? (n.vibeGroup && !e[n.vibeGroup] && (n.vibeGroup = ""), n.vibeGroup || (n.vibeGroup = e["默认组"] ? "默认组" : t[0]), b.innerHTML = t.map(function(e) {
                        return '<option value="' + k(e) + '"' + (e === n.vibeGroup ? " selected" : "") + ">" + k(e) + "</option>"
                    }).join(""), b.value = n.vibeGroup, I.put(n)) : b.innerHTML = '<option value="">（暂无 Vibe 组，去 Vibe 库新建）</option>', m()
                }
            }(), u && u.addEventListener("click", function() {
                if (!W()) return void E("未检测到智绘姬（st-chatu8）", "error");
                const e = (n.name || "").trim();
                if (!e) return void E("该收藏没有名称", "warning");
                Y(e, n.positive || "", n.negative || "");
                nlApplyPresetParams(n);
                const t = function(e) {
                    var t = W();
                    if (!t) return !1;
                    t.yusheid_novelai = e;
                    var n = t.yushe && t.yushe[e] || {};
                    X();
                    try {
                        var r = window.parent && window.parent.document || s,
                            a = window.parent && (window.parent.jQuery || window.parent.$),
                            i = r.getElementById("yusheid_novelai");
                        return i && (i.value = e, a && a(i).val(e)), [{
                            id: "fixedPrompt_novelai",
                            val: n.fixedPrompt || ""
                        }, {
                            id: "fixedPrompt_end_novelai",
                            val: n.fixedPrompt_end || ""
                        }, {
                            id: "negativePrompt_novelai",
                            val: n.negativePrompt || ""
                        }].forEach(function(e) {
                            var t = r.getElementById(e.id);
                            t && (t.value = e.val, a ? a(t).val(e.val).trigger("input").trigger("change") : (t.dispatchEvent(new Event("input", {
                                bubbles: !0
                            })), t.dispatchEvent(new Event("change", {
                                bubbles: !0
                            }))))
                        }), !0
                    } catch (e) {}
                    return !1
                }(e);
            applyPresetVibeBinding(n), async function() {
                t ? E("已设为当前预设「" + e + "」", "success") : E("已写入预设，请在智绘姬面板确认", "info"), nlRefreshFloatingBall(), R()
            }()
        });
        (function(){
            var pg = i.querySelector("#nl-dparam-group"),
                pf = i.querySelector("#nl-dparam-fields");
            if (!pg || !pf) return;
            function curGroup(){ return n.naiParamGroup || NL_DEFAULT_PARAM_GROUP; }
            function sortedKeys(groups){ return Object.keys(groups).sort(function(a,b){ return a===NL_DEFAULT_PARAM_GROUP?-1:b===NL_DEFAULT_PARAM_GROUP?1:a.localeCompare(b,"zh-CN"); }); }
            function fillGroupSel(){
                nlEnsureDefaultParamGroup();
                nlBindChatuNaiParamReverseSync();
                var groups = nlGetParamGroups(), keys = sortedKeys(groups), cg = curGroup();
                if (cg && !groups[cg]) cg = "";
                if (!cg) cg = groups[NL_DEFAULT_PARAM_GROUP] ? NL_DEFAULT_PARAM_GROUP : keys[0];
                n.naiParamGroup = cg || "";
                pg.innerHTML = keys.length ? keys.map(function(e){ return '<option value="'+k(e)+'"'+(e===cg?' selected':'')+'>'+k(e)+'</option>'; }).join("") : '<option value="">（暂无参数组）</option>';
                pg.value = cg || "";
            }
            function fillFields(){
                var groups = nlGetParamGroups(), cg = curGroup(), g = groups[cg], params = g && g.params || {};
                pf.innerHTML = nlRenderParamFieldInputs("nl-dparam-pf-", params);
                bindFields();
            }
            async function saveAndApply(ev){
                var sg = curGroup();
                if (!sg) return;
                ev && ev.target && ev.target.getAttribute("data-pf") === "novelai_size" && nlSyncParamSizeInputs(pf, "nl-dparam-pf-");
                var params = nlReadParamFieldInputs(pf, "nl-dparam-pf-");
                nlSaveParamGroup(sg, params);
                n.naiParamGroup = sg;
                n.naiParams = params;
                await I.put(n);
                nlApplyParamGroup(sg);
            }
            function bindFields(){
                pf.querySelectorAll("[data-pf]").forEach(function(el){
                    ["input", "change"].forEach(function(ev){
                        el.addEventListener(ev, saveAndApply)
                    })
                })
            }
            fillGroupSel(); fillFields();
            pg.addEventListener("change", async function(){
                n.naiParamGroup = pg.value;
                n.naiParams = (nlGetParamGroups()[pg.value] || {}).params || {};
                await I.put(n);
                fillFields();
                nlApplyParamGroup(pg.value);
            });
        })();
        const $ = i.querySelector("#nl-dthumbimg"),
            S = i.querySelector("#nl-dthumbfile");
        if ($) {
            $.addEventListener("click", function(e) {
                e.stopPropagation();
                $._nlDThumbClickT && clearTimeout($._nlDThumbClickT), $._nlDThumbClickT = setTimeout(function() {
                    $._nlDThumbClickT = null, n.thumb ? nlShowImagePreview(n.thumb, n.name) : E("该预设暂无预览图", "info")
                }, 260)
            });
            $.addEventListener("dblclick", function(e) {
                e.stopPropagation(), e.preventDefault(), $._nlDThumbClickT && (clearTimeout($._nlDThumbClickT), $._nlDThumbClickT = null), nlChangePresetThumb(n, i, function() {
                    nlRefreshFloatingBall(), R(), Q(n.id)
                })
            })
        }
        S && S.remove(), i.querySelector("#nl-del").addEventListener("click", async () => {
            if (confirm('确定删除"' + (n.name || "未命名") + '"？')) {
                await I.del(e), w(n.name);
                try {
                    var t = W();
                    t && t.yushe && t.yushe[n.name] && delete t.yushe[n.name], t && t.yusheid_novelai === n.name && (t.yusheid_novelai = ""), X()
                } catch (e) {}
                try {
                    var r = (window.parent && window.parent.document || document).getElementById("yusheid_novelai");
                    if (r) {
                        var a = Array.from(r.options).find(e => e.value === n.name);
                        a && a.remove(), r.value === n.name && (r.value = "");
                        var o = window.parent && (window.parent.jQuery || window.parent.$);
                        o && o(r).trigger("change")
                    }
                } catch (e) {}
                E("已删除", "success"), i.remove(), R()
            }
        })
    }

    function F() {
        try {
            var e = window.parent;
            if (e && e.SillyTavern && e.SillyTavern.getContext) return e.SillyTavern.getContext()
        } catch (e) {}
        return null
    }

    function W() {
        var e = F();
        if (!e) return null;
        var t = e.extensionSettings || window.parent && window.parent.extension_settings;
        return t && t["st-chatu8"] || null
    }

    function X() {
        var e = F();
        try {
            e && e.saveSettingsDebounced && e.saveSettingsDebounced()
        } catch (e) {}
    }

    function Y(e, t, n) {
        var r = W();
        if (!r) return !1;
        r.yushe || (r.yushe = {}), r.yushe[e] = {
            fixedPrompt: t || "",
            fixedPrompt_end: "",
            negativePrompt: n || ""
        }, X();
        try {
            var a = window.parent && window.parent.document || s,
                i = a.getElementById("yusheid_novelai");
            if (i) {
                for (var o = !1, l = 0; l < i.options.length; l++)
                    if (i.options[l].value === e) {
                        o = !0;
                        break
                    } if (!o) {
                    var c = a.createElement("option");
                    c.value = e, c.textContent = e, i.appendChild(c)
                }
            }
        } catch (e) {}
        return !0
    }

    function K() {
        var e = [];
        try {
            var t = W(),
                n = t && t.vibePresets || {};
            Object.keys(n).forEach(function(t) {
                var r = n[t];
                r && "object" == typeof r && r.vibeDataId && e.push({
                    presetName: t,
                    vibeDataId: r.vibeDataId,
                    name: t,
                    thumb: r.thumbnail || "",
                    model: r.model || "",
                    strength: "number" == typeof r.strength ? r.strength : .6,
                    imageId: r.imageId || null
                })
            })
        } catch (e) {}
        return e
    }
    function _vibeImageSrc(e) {
        return "string" == typeof e && 0 === e.indexOf("data:") ? e : "data:image/png;base64," + e
    }
    function _makeVibeThumbnail(e) {
        return new Promise(function(t) {
            try {
                var n = new Image;
                n.onload = function() {
                    try {
                        var r = n.naturalWidth, a = n.naturalHeight;
                        if (!r || !a) return t("");
                        var i = Math.min(1, 96 / Math.max(r, a));
                        r = Math.round(r * i), a = Math.round(a * i);
                        var o = s.createElement("canvas");
                        o.width = r, o.height = a, o.getContext("2d").drawImage(n, 0, 0, r, a), t(o.toDataURL("image/jpeg", .7))
                    } catch (e) {
                        t("")
                    }
                }, n.onerror = function() {
                    t("")
                }, n.src = _vibeImageSrc(e)
            } catch (e) {
                t("")
            }
        })
    }
    async function _repairMissingVibeThumbnails() {
        try {
            var e = W(), t = e && e.vibePresets || {}, n = !1;
            for (var r of Object.keys(t)) {
                var a = t[r];
                if (a && a.vibeDataId && !a.thumbnail) try {
                    var i = await D(a.vibeDataId), o = i && i.data ? JSON.parse(i.data) : null;
                    if (o && o.image) {
                        var l = await _makeVibeThumbnail(o.image);
                        l && (a.thumbnail = l, n = !0)
                    }
                } catch (e) {}
            }
            n && X()
        } catch (e) {}
    }
    function re() {
        var e = W();
        return e ? (e.vibeGroups || (e.vibeGroups = {}), e.vibeGroups) : null
    }
    async function ae(e, t) {
        try {
            for (var n = await I.all(), r = 0; r < n.length; r++) {
                var a = n[r];
                if (a && a.vibeGroup === e) {
                    a.vibeGroup = t || "";
                    try {
                        await I.put(a)
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }

    async function oeRenameVibeGroup(e, t) {
        var n = W();
        if (!(n && n.vibeGroups && n.vibeGroups[e]) || "默认组" === e) return !1;
        if (!(t = (t || "").trim()) || t === e || Object.prototype.hasOwnProperty.call(n.vibeGroups, t)) return !1;
        n.vibeGroups[t] = n.vibeGroups[e];
        delete n.vibeGroups[e];
        n.vibeGroupId === e && (n.vibeGroupId = t);
        oe === e && (oe = t);
        X();
        await ae(e, t);
        oeSetCurrentGroup(t);
        return !0
    }

    var oeNativeSyncing = !1,
        oeLastNativeStrengthSignature = "";

    function ie(e) {
        var t = W();
        if (!t || !t.vibeGroups || !t.vibeGroups[e]) return !1;
        t.vibeGroupId = e, X();
        try {
            var n = window.parent && window.parent.document || s,
                r = window.parent && (window.parent.jQuery || window.parent.$),
                as = n.querySelectorAll("#vibe-group-select");
            oeNativeSyncing = !0, setTimeout(function() {
                oeNativeSyncing = !1
            }, 0), as.forEach(function(a) {
                for (var i = !1, o = 0; o < a.options.length; o++)
                    if (a.options[o].value === e) {
                        i = !0;
                        break
                    } if (!i) {
                    var l = n.createElement("option");
                    l.value = e, l.textContent = e, a.appendChild(l)
                }
                a.value = e
            });
            if (as.length > 0) {
                var last = as[as.length - 1];
                r ? r(last).val(e).trigger("change") : last.dispatchEvent(new Event("change", {
                    bubbles: !0
                }))
            }
        } catch (e) {
            oeNativeSyncing = !1
        }
        return !0
    }

    function oeRefreshOpenVibePanel() {
        try {
            nlIsVibeTabActive() && le()
        } catch (e) {}
    }

    function oeSyncCurrentGroupDisplay(e, t) {
        var n = re() || {};
        if (!e || !n[e]) return !1;
        return oe = e, W() && (W().vibeGroupId = e, X()), t || (oeRefreshOpenVibePanel(), oeRefreshDetailVibeViews(e)), !0
    }

    function oeGroupStrengthSignature(e) {
        var t = (re() || {})[e];
        return t && t.vibes ? t.vibes.map(function(e) {
            return (e.vibeDataId || "") + ":" + ("number" == typeof e.strength ? e.strength : "")
        }).join("|") : ""
    }

    async function oeSyncActivePresetStrengths(e) {
        try {
            var t = W(),
                n = t && (t.yusheid_novelai || "").trim(),
                r = e || oeGetActiveGroup(),
                a = (re() || {})[r];
            if (!t || !n || !a || !a.vibes) return !1;
            var i = (await I.all()).filter(function(e) {
                return (e.name || "").trim() === n
            })[0];
            if (!i || !i.vibeEnabled || i.vibeGroup !== r) return !1;
            var o = !1;
            i.vibeStrengths || (i.vibeStrengths = {}), a.vibes.forEach(function(e) {
                e && e.vibeDataId && "number" == typeof e.strength && i.vibeStrengths[e.vibeDataId] !== e.strength && (i.vibeStrengths[e.vibeDataId] = e.strength, o = !0)
            });
            return o && (await I.put(i), oeRefreshDetailStrengthViews(i)), o
        } catch (e) {
            return !1
        }
    }

    function oeRefreshDetailStrengthViews(e) {
        try {
            var t = s.getElementById(r);
            if (!t || !e || !e.vibeStrengths) return;
            t.querySelectorAll(".nl-dslot-strength").forEach(function(t) {
                var n = t.getAttribute("data-vid"),
                    r = e.vibeStrengths[n];
                if ("number" == typeof r) {
                    t.value = r;
                    var a = t.parentNode && t.parentNode.querySelector(".nl-slot-strv");
                    a && (a.textContent = r.toFixed(2))
                }
            })
        } catch (e) {}
    }

    function oeBindNativeVibeGroupSelects() {
        try {
            var e = window.parent && window.parent.document || s;
            e.querySelectorAll("#vibe-group-select").forEach(function(e) {
                e.__naiVibeGroupBound || (e.__naiVibeGroupBound = !0, e.addEventListener("change", function() {
                    oeNativeSyncing || nlConfirmVibePending() && (oeSyncCurrentGroupDisplay(e.value), oeLastNativeStrengthSignature = oeGroupStrengthSignature(e.value))
                }))
            })
        } catch (e) {}
    }

    function oePollNativeVibeStrengths() {
        try {
            var e = oeGetActiveGroup(),
                t = oeGroupStrengthSignature(e);
            e && (oeLastNativeStrengthSignature ? t && t !== oeLastNativeStrengthSignature && oeSyncActivePresetStrengths(e) : oeLastNativeStrengthSignature = t, oeLastNativeStrengthSignature = t)
        } catch (e) {}
    }

    function oeSyncEnabled(e) {
        var t = W();
        if (!t) return;
        t.enableVibeGroupTransfer = e ? "true" : "false", X();
        try {
            var n = window.parent && window.parent.document || s,
                r = window.parent && (window.parent.jQuery || window.parent.$),
                a = n.getElementById("enableVibeGroupTransfer");
            a && (a.checked = !!e, r ? r(a).prop("checked", !!e).trigger("change") : a.dispatchEvent(new Event("change", {
                bubbles: !0
            })))
        } catch (e) {}
    }

    function oeGetActiveGroup() {
        var e = W(),
            t = re() || {};
        return e && e.vibeGroupId && t[e.vibeGroupId] ? e.vibeGroupId : oe && t[oe] ? oe : t["默认组"] ? "默认组" : Object.keys(t)[0] || ""
    }

    function oeRefreshDetailVibeViews(e) {
        try {
            var t = s.getElementById(r);
            if (!t) return;
            t.querySelectorAll("#nl-dvibe-group").forEach(function(t) {
                for (var n = !1, r = 0; r < t.options.length; r++)
                    if (t.options[r].value === e) {
                        n = !0;
                        break
                    } n && (t.value = e)
            })
        } catch (e) {}
    }

    function oeSetCurrentGroup(e, t) {
        var n = re() || {};
        return !(!e || !n[e]) && (oe = e, ie(e), t || oeRefreshDetailVibeViews(e), !0)
    }


    function nlIsVibeTabActive() {
        var e = s.getElementById(r),
            t = e && e.querySelector(".nl-tab.active");
        return !!(t && "vibe" === t.getAttribute("data-tab"))
    }

    function nlConfirmVibePendingIfVibeTab() {
        return !nlIsVibeTabActive() || nlConfirmVibePending()
    }

    function nlHasVibePending() {
        return !!(nlVibePending && Object.keys(nlVibePending).length)
    }

    function nlCaptureVibePending(e) {
        var t = re(),
            n = t && t[oe];
        e && n && n.vibes && e.querySelectorAll(".nl-slot-strength").forEach(function(e) {
            var t = parseInt(e.getAttribute("data-slot"), 10),
                r = parseFloat(e.value),
                a = n.vibes[t];
            if (!isNaN(t) && !isNaN(r) && (!a || "number" != typeof a.strength || Math.abs(a.strength - r) >= .0001)) nlVibePending[t] = r
        })
    }

    function nlSaveVibePending() {
        var e = re(),
            t = e && e[oe],
            n = nlVibePending ? Object.keys(nlVibePending) : [];
        return !!(t && t.vibes && n.length) && (n.forEach(function(e) {
            var n = parseInt(e, 10);
            t.vibes[n] && (t.vibes[n].strength = nlVibePending[e])
        }), t.updatedAt = Date.now(), X(), oe === oeGetActiveGroup() && (ie(oe), oeSyncActivePresetStrengths(oe), oeLastNativeStrengthSignature = oeGroupStrengthSignature(oe)), nlVibePending = {}, !0)
    }

    function nlConfirmVibePending() {
        var e = s.getElementById(r),
            t = e && e.querySelector('.nl-body[data-view="vibe"]');
        nlCaptureVibePending(t);
        if (!nlHasVibePending()) return !0;
        return confirm("当前 Vibe 叠加组设置未保存，是否保存？") && nlSaveVibePending(), nlVibePending = {}, !0
    }
    var oe = null,
        _vlf = !1;

    function le() {
        const e = s.getElementById(r).querySelector('.nl-body[data-view="vibe"]');
        if (!W()) return void(e.innerHTML = '<div class="nl-empty">未检测到智绘姬（st-chatu8），无法使用 Vibe 功能</div>');
        ! function() {
            var e = W();
            e && (e.vibeGroups || (e.vibeGroups = {}), e.vibeGroups["默认组"] || (e.vibeGroups["默认组"] = {
                vibes: [],
                coverImageId: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }), e.vibeGroupId || (e.vibeGroupId = "默认组"), X())
        }();
        const t = K(),
            n = re() || {},
            a = function() {
                var e = W();
                return e && e.vibeGroupId || "默认组"
            }();
        let i;
        a && n[a] ? oe = a : oe && n[oe] || (oe = a), i = t.length ? '<div class="nl-vibe-grid">' + t.map(function(e) {
            var t = e.thumb ? '<img class="nl-vibe-card-thumb" draggable="false" oncontextmenu="return false" src="' + e.thumb + '">' : '<div class="nl-vibe-card-thumb empty">&#127912;</div>',
                n = k(e.presetName),
                r = k(e.vibeDataId || "");
            return '<div oncontextmenu="return false" class="nl-vibe-card" data-preset="' + n + '" data-vid="' + r + '">' + t + '<div class="nl-vibe-card-name">' + k(e.name || "未命名") + '</div><div class="nl-vibe-card-acts"><span class="nl-vibe-add" data-vid="' + r + '" title="加入当前组">＋</span><span class="nl-vibe-del" data-preset="' + n + '" title="删除">✕</span></div></div>'
        }).join("") + "</div>" : '<div class="nl-empty" style="padding:18px;">还没有 Vibe，可先在智绘姬中导入后同步显示</div>';
        var o, l = Object.keys(n).sort(function(e, t) {
                return "默认组" === e ? -1 : "默认组" === t ? 1 : e.localeCompare(t, "zh-CN")
            }).map(function(e) {
                return '<option value="' + k(e) + '"' + (e === oe ? " selected" : "") + ">" + k(e) + (e === a ? "（当前）" : "") + "</option>"
            }).join(""),
            c = (n[oe] || {
                vibes: []
            }).vibes || [];
        o = c.length ? c.map(function(e, n) {
                var r = t.filter(function(t) {
                        return t.vibeDataId === e.vibeDataId
                    })[0],
                    a = r ? r.name : "（未知）" + (e.vibeDataId || "").slice(0, 8),
                    i = r && r.thumb ? '<img class="nl-vibe-slot-thumb" draggable="false" oncontextmenu="return false" src="' + r.thumb + '">' : '<div class="nl-vibe-slot-thumb empty">&#127912;</div>',
                    o = "number" == typeof e.strength ? e.strength : .6;
                return '<div class="nl-vibe-slot" data-slot="' + n + '">' + i + '<div class="nl-vibe-slot-body"><div class="nl-vibe-slot-name">' + k(a) + '</div><label class="nl-vibe-row"><span>强度 <b class="nl-slot-strv">' + o.toFixed(2) + '</b></span><input type="range" class="nl-slot-strength" data-slot="' + n + '" min="0" max="1" step="0.01" value="' + o + '"></label></div><span class="nl-vibe-slot-del" data-slot="' + n + '" title="移出组">✕</span></div>'
            }).join("") : '<div class="nl-empty" style="padding:14px;">该组为空，去上方列表点「＋组」添加 Vibe（可叠加多个）</div>', e.innerHTML = '<div class="nl-vibe-sec-title">Vibe 列表</div><div class="nl-vibe-listwrap">' + i + '</div><div class="nl-vibe-sec-title" style="margin-top:18px;">Vibe 叠加组</div><div class="nl-vibe-grouprow"><select class="nl-input" id="nl-vibe-groupsel" style="flex:1;">' + l + '</select><button class="nl-btn ghost nl-vibe-groupbtn" id="nl-vibe-newgroup">新建组</button><button class="nl-btn ghost nl-vibe-groupbtn" id="nl-vibe-renamegroup">重命名</button><button class="nl-btn ghost nl-vibe-groupbtn" id="nl-vibe-delgroup">删组</button><button class="nl-btn ghost nl-vibe-groupbtn" id="nl-vibe-savegroup">保存</button></div><div class="nl-vibe-slots">' + o + "</div>",
            function(e) {
                e.querySelectorAll(".nl-vibe-add").forEach(function(e) {
                    e.addEventListener("click", function() {
                        var t = e.getAttribute("data-vid"),
                            n = re();
                        if (n && n[oe]) {
                            var r = n[oe];
                            Array.isArray(r.vibes) || (r.vibes = []), r.vibes.some(function(e) {
                                return e.vibeDataId === t
                            }) ? E("该 Vibe 已在组中", "info") : r.vibes.length >= 4 ? E("单组最多 4 个 Vibe 叠加", "warning") : (r.vibes.push({
                                vibeDataId: t,
                                strength: .6
                            }), r.updatedAt = Date.now(), X(), E("已加入组「" + oe + "」", "success"), le())
                        }
                    })
                }), e.querySelectorAll(".nl-vibe-del").forEach(function(e) {
                    e.addEventListener("click", async function() {
                        var t = e.getAttribute("data-preset");
                        "默认" !== t ? confirm("删除预设「" + t + "」？") && (await async function(e) {
                            var t = W();
                            if (t && t.vibePresets && t.vibePresets[e]) {
                                var n = t.vibePresets[e];
                                try {
                                    n.imageId && await z(n.imageId)
                                } catch (e) {}
                                var r = n.vibeDataId;
                                if (delete t.vibePresets[e], t.vibePresetId === e && (t.vibePresetId = "默认"), r) {
                                    var a = !1;
                                    if (Object.keys(t.vibePresets).forEach(function(e) {
                                            t.vibePresets[e] && t.vibePresets[e].vibeDataId === r && (a = !0)
                                        }), !a && t.vibeGroups && Object.keys(t.vibeGroups).forEach(function(e) {
                                            var n = t.vibeGroups[e];
                                            n && Array.isArray(n.vibes) && n.vibes.some(function(e) {
                                                return e.vibeDataId === r
                                            }) && (a = !0)
                                        }), !a) try {
                                        await z(r)
                                    } catch (e) {}
                                }
                                X()
                            }
                        }(t), E("已删除", "success"), le()) : E("默认预设不可删除", "warning")
                    })
                });
                var i = e.querySelector("#nl-vibe-groupsel");
                i && i.addEventListener("change", function() {
                    nlConfirmVibePending() ? (oeSetCurrentGroup(i.value), le()) : i.value = oe
                });
                var o = e.querySelector("#nl-vibe-newgroup");
                o && o.addEventListener("click", function() {
                    var e = prompt("输入新组名称：");
                    if (e)
                        if (e = e.trim()) {
                            var t = re();
                            t[e] ? E("已存在同名组", "error") : (t[e] = {
                                vibes: [],
                                coverImageId: null,
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                            }, X(), oeSetCurrentGroup(e, !0), E("已创建组「" + e + "」", "success"), le())
                        } else E("组名不能为空", "error")
                });
                var l = e.querySelector("#nl-vibe-renamegroup");
                l && l.addEventListener("click", async function() {
                    if ("默认组" !== oe) {
                        var e = prompt("新的组名：", oe);
                        null != e && ((e = e.trim()) ? e !== oe && (await oeRenameVibeGroup(oe, e) ? (E("已重命名组", "success"), le()) : E("重命名失败（可能重名）", "error")) : E("组名不能为空", "error"))
                    } else E("默认组不可重命名", "warning")
                });
                var s = e.querySelector("#nl-vibe-delgroup");
                s && s.addEventListener("click", function() {
                    if ("默认组" !== oe) {
                        if (confirm("删除组「" + oe + "」？组内 Vibe 本身不会被删。")) {
                            var e = W(),
                                t = re(),
                                n = oe;
                            delete t[n], e.vibeGroupId === n && (e.vibeGroupId = "默认组"), X(), ae(n, ""), oeSetCurrentGroup("默认组", !0), E("已删除组", "success"), le()
                        }
                    } else E("默认组不可删除", "warning")
                });
                nlVibePending = nlVibePending || {}, e.querySelectorAll(".nl-slot-strength").forEach(function(e) {
                        e.addEventListener("input", function() {
                            var t = parseInt(e.getAttribute("data-slot"), 10),
                                n = parseFloat(e.value);
                            nlVibePending[t] = n;
                            var r = e.parentNode.querySelector(".nl-slot-strv");
                            r && (r.textContent = n.toFixed(2))
                        })
                    }), e.__naiVibeSaveClickBound || (e.__naiVibeSaveClickBound = !0, e.addEventListener("click", function(t) {
                        var n = t.target && t.target.closest && t.target.closest("#nl-vibe-savegroup");
                        n && (t.preventDefault(), t.stopPropagation(), nlCaptureVibePending(e), nlSaveVibePending() ? E("已保存", "success") : E("没有需要保存的修改", "info"))
                    })), e.querySelectorAll(".nl-vibe-slot-del").forEach(function(e) {
                        e.addEventListener("click", function() {
                            var t = parseInt(e.getAttribute("data-slot"), 10),
                                n = re(),
                                r = n && n[oe];
                            r && r.vibes && (r.vibes.splice(t, 1), r.updatedAt = Date.now(), X(), le())
                        })
                    })
            }(e)
    }
    var se = null,
        nlVibePending = {};

    function ce() {
        try {
            oeBindNativeVibeGroupSelects(), oePollNativeVibeStrengths();
            if (s.getElementById(n)) return;
            var t = s.getElementById("extensionsMenu");
            if (!t) return;
            var r = s.createElement("div");
            r.id = n, r.className = "list-group-item flex-container flexGap5 interactable", r.title = e, r.tabIndex = 0, r.innerHTML = '<i class="fa-solid fa-chevron-down fa-fw"></i><span>' + e + "</span>";
            var a = function(e) {
                e && (e.preventDefault(), e.stopPropagation()); var panel = N(); panel.style.display = "flex"; var active = panel.querySelector(".nl-tab.active"); active && active.getAttribute("data-tab") === "lib" ? R() : M("lib")
            };
            r.addEventListener("click", a), r.addEventListener("touchend", a);
            var i = function() {
                try {
                    if (window.parent && (window.parent.jQuery || window.parent.$)) return window.parent.jQuery || window.parent.$
                } catch (e) {}
                try {
                    if (void 0 !== window.jQuery) return window.jQuery
                } catch (e) {}
                try {
                    if ("undefined" != typeof $) return $
                } catch (e) {}
                return null
            }();
            if (i) try {
                i(r).on("click touchend", a)
            } catch (e) {}
            t.appendChild(r)
        } catch (e) {}
    }
    setInterval(ce, 2e3), setTimeout(ce, 500), setTimeout(nlRefreshFloatingBall, 800), setTimeout(nlRefreshFloatingBall, 2200);
    /* 启动时执行旧数据迁移 */
    setTimeout(function() { _migrateOldData().catch(function(e) { console.log("[NAI] 迁移旧数据失败:", e); }); }, 1000);
    /* 首次无参数组时自动建「默认」组 */
    setTimeout(function() { try { nlEnsureDefaultParamGroup(); } catch (e) {} }, 3000);
setTimeout(function() { _syncVibeImageMirror().catch(function(e) { console.log("[NAI] 同步 Vibe 数据失败:", e); }); }, 1800);
}();
