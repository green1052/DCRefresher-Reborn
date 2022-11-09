<template>
    <div id="refresher-app">
        <div class="refresher-add-block-popup"/>
        <div class="refresher-title-zone">
            <h1>설정</h1>
            <div class="float-right">
                <p :class="{active: tab === 0}" v-on:click="() => tab = 0">일반</p>
                <p :class="{active: tab === 1}" v-on:click="() => tab = 1">고급</p>
                <p :class="{active: tab === 2}" v-on:click="() => tab = 2">차단</p>
                <p :class="{active: tab === 3}" v-on:click="() => tab = 3">메모</p>
                <p :class="{active: tab === 4}" v-on:click="()=> tab = 4">모듈</p>
                <p :class="{active: tab === 5}" v-on:click="() => tab = 5">단축키</p>
            </div>
        </div>
        <transition-group name="refresher-slide-left" mode="in-out">
            <div class="tab tab1" v-show="tab === 0" key="tab1">
                <div class="info">
                    <div class="icon-wrap">
                        <img :src="getURL('/assets/icons/logo/Icon.png')" class="icon"/>
                        <img :src="getURL('/assets/icons/logo/Icon.png')" class="icon-backdrop"/>
                    </div>

                    <div class="text">
                        <h3>DCRefresher Reborn</h3>
                        <p>
                            <span
                                class="version">v{{ this.RefresherVersion }}{{ this.RefresherDevMode ? " (dev mode)" : "" }}</span>
                            <a v-for="link in links" v-on:click="open(link.url)">{{ link.text }}</a>
                        </p>
                    </div>
                </div>

                <div class="settings">
                    <div v-if="!Object.keys(settings).length">
                        <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                    </div>

                    <div class="refresher-setting-category" v-else v-for="module in Object.keys(settings)">
                        <h3 v-on:click="moveToModuleTab(module)">{{ module }}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="18px"
                                 height="18px">
                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                            </svg>
                        </h3>

                        <div class="refresher-setting" v-for="setting in Object.keys(settings[module])"
                             v-if="!settings[module][setting].advanced"
                             :data-changed="settings[module][setting].value !== settings[module][setting].default">
                            <div class="info">
                                <h4>{{ settings[module][setting].name }}</h4>
                                <p>{{ settings[module][setting].desc }}</p>
                                <p class="mute">(기본 값 : {{ typeWrap(settings[module][setting].default) }})</p>
                            </div>

                            <div class="control">
                                <refresher-checkbox v-if="settings[module][setting].type === 'check'"
                                                    :checked="settings[module][setting].value"
                                                    :change="updateUserSetting" :modname="module"
                                                    :id="setting"></refresher-checkbox>
                                <refresher-input v-if="settings[module][setting].type === 'text'"
                                                 :placeholder="settings[module][setting].default"
                                                 :value="settings[module][setting].value" :id="setting"
                                                 :modname="module" :change="updateUserSetting"></refresher-input>
                                <refresher-range v-if="settings[module][setting].type === 'range'"
                                                 :placeholder="settings[module][setting].default"
                                                 :value="Number(settings[module][setting].value)" :id="setting"
                                                 :modname="module" :change="updateUserSetting"
                                                 :min="settings[module][setting].min"
                                                 :max="settings[module][setting].max"
                                                 :step="settings[module][setting].step"
                                                 :unit="settings[module][setting].unit"></refresher-range>
                                <refresher-options v-if="settings[module][setting].type === 'option'"
                                                   :options="settings[module][setting].items"
                                                   :change="updateUserSetting" :modname="module"></refresher-options>
                                <refresher-dccon v-if="settings[module][setting].type === 'dccon'"
                                                 :placeholder="settings[module][setting].default"
                                                 :value="settings[module][setting].value" :id="setting"
                                                 :modname="module" :change="updateUserSetting"></refresher-dccon>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tab tab2" v-show="tab === 1" key="tab2">
                <div v-if="!Object.keys(settings).length">
                    <h3 class="need-refresh">우선 디시 페이지를 열고 설정 해주세요.</h3>
                </div>
                <div class="refresher-setting-category" v-for="module in Object.keys(settings)"
                     v-if="settings[module] &amp;&amp; advancedSettingsCount(settings[module])">
                    <h3 v-on:click="moveToModuleTab(module)">{{ module }}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="18px"
                             height="18px">
                            <path d="M0 0h24v24H0z" fill="none"/>
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                        </svg>
                    </h3>
                    <div class="refresher-setting" v-for="setting in Object.keys(settings[module])"
                         v-if="settings[module][setting].advanced"
                         :data-changed="settings[module][setting].value !== settings[module][setting].default">
                        <div class="info">
                            <h4>{{ settings[module][setting].name }}</h4>
                            <p>{{ settings[module][setting].desc }}</p>
                            <p class="mute">(기본 값 : {{ typeWrap(settings[module][setting].default) }})</p>
                        </div>
                        <div class="control">
                            <refresher-checkbox v-if="settings[module][setting].type === 'check'"
                                                :checked="settings[module][setting].value" :change="updateUserSetting"
                                                :modname="module" :id="setting"></refresher-checkbox>
                            <refresher-input v-if="settings[module][setting].type === 'text'"
                                             :placeholder="settings[module][setting].default"
                                             :value="settings[module][setting].value" :id="setting" :modname="module"
                                             :change="updateUserSetting"></refresher-input>
                            <refresher-range v-if="settings[module][setting].type === 'range'"
                                             :placeholder="settings[module][setting].default"
                                             :value="Number(settings[module][setting].value)" :id="setting"
                                             :modname="module" :change="updateUserSetting"
                                             :min="settings[module][setting].min" :max="settings[module][setting].max"
                                             :step="settings[module][setting].step"
                                             :unit="settings[module][setting].unit"></refresher-range>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tab tab3" v-show="tab === 2" key="tab3">
                <div class="block-divide" v-for="key in Object.keys(blocks)">
                    <h3>{{ blockKeyNames[key] }} <span class="plus" v-on:click="() => addEmptyBlockedUser(key)"><svg
                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="18px" height="18px">
                                <path d="M0 0h24v24H0z" fill="none"/>
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg></span></h3>
                    <div class="lists">
                        <p v-if="!blocks[key].length">차단된 {{ blockKeyNames[key] }} 없음</p>

                        <refresher-bubble v-if="key !== 'DCCON'" v-for="(blocked, i) in blocks[key]" :key="'block:' + i"
                                          :text="blocked.content" :regex="blocked.isRegex" :gallery="blocked.gallery"
                                          :extra="blocked.extra" :remove="() => removeBlockedUser(key, i)"
                                          :textclick="() => editBlockedUser(key, i)"/>

                        <refresher-bubble v-else v-for="(blocked, i) in blocks[key]" :key="'block:' + i"
                                          :image="'https://dcimg5.dcinside.com/dccon.php?no='+blocked.content.split('||')[2]"
                                          :regex="blocked.isRegex" :gallery="blocked.gallery" :extra="blocked.extra"
                                          :remove="() => removeBlockedUser(key, i)"
                                          :textclick="() => editBlockedUser(key, i)"/>
                    </div>
                </div>
            </div>
            <div class="tab tab4" v-show="tab === 3" key="tab4">
                <p v-if="!Object.keys(memos).length">메모가 없습니다.</p>
                <div class="block-divide" v-for="[key] in Object.entries(memos)">
                    <div class="list">
                        <refresher-bubble :text="key" :remove="() => removeMemoUser(key)"
                                          :textclick="() => editMemoUser(key)"></refresher-bubble>
                    </div>
                </div>
            </div>
            <div class="tab tab5" v-show="tab === 4" key="tab5">
                <div class="refresher-no-modules" v-if="!Object.keys(modules).length">
                    <h3>로드된 모듈 없음</h3>
                    <p>우선 디시 페이지를 열어주세요.</p>
                </div>
                <div v-else>
                    <refresher-module v-for="module in modules" :key="module.name" :name="module.name"
                                      :desc="module.description" :enabled="module.enable" :author="module.author"
                                      :requirement="module.require"></refresher-module>
                </div>
            </div>
            <div class="tab tab6" v-show="tab === 5" key="tab6">
                <div class="shortcut-lists">
                    <div class="refresher-shortcut" v-for="shortcut in shortcuts" v-if="shortcut.description.length">
                        <p class="description">{{ shortcut.description }}</p>
                        <div class="key">
                            <refresher-bubble v-for="key in shortcut.shortcut.match(shortcutRegex)" :key=key
                                              :text="key"/>
                            <refresher-bubble v-if="!shortcutRegex.test(shortcut.shortcut)" text="키 없음"/>
                        </div>
                    </div>
                </div>
                <p><a v-on:click="openShortcutSettings">단축키 설정</a></p>
            </div>
        </transition-group>
    </div>
</template>

<script>
import checkbox from "./checkbox";
import module from "./module";
import options from "./options";
import input from "./input";
import range from "./range";
import bubble from "./bubble";
import dccon from "./dccon";
import browser from "webextension-polyfill";

const port = browser.runtime.connect({name: "refresherInternal"});

const createDCConSelector = () => {
    alert("아직 디시콘 차단 기능을 사용할 수 없습니다.");
    // return;
    //
    // browser.windows.create(
    //     {
    //         url: "views/dcconSelection.html",
    //         type: "popup",
    //         height: 800,
    //         width: 400
    //     },
    //     function (window) {
    //     }
    // );
};

export default {
    name: "refresher",
    data: () => {
        return {
            tab: 0,
            modules: [],
            settings: {},
            shortcuts: {},
            blocks: {},
            blockModes: {},
            memos: {},
            memoKeyNames: {
                UID: "유저 ID",
                NICK: "닉네임",
                IP: "IP"
            },
            shortcutRegex: /(Space|⌥|⇧|⌘|⌃|Alt|Cmd|,|'|`|Home|End|PageUp|PageDown|Insert|Delete|Left|Up|Right|Down|[A-Z]|[0-9])/g,
            blockKeyNames: {
                NICK: "닉네임",
                ID: "아이디",
                IP: "IP",
                TEXT: "내용",
                DCCON: "디시콘"
            },
            links: [
                {
                    text: "GitHub",
                    url: "https://github.com/green1052/DCRefresher-Reborn"
                }
            ]
        };
    },
    props: {
        RefresherVersion: {
            type: String
        },
        RefresherDevMode: {
            type: Boolean
        }
    },
    created() {
        console.log(this.RefresherDevMode);

    },
    methods: {
        getURL(url) {
            return browser.runtime.getURL(url);
        },

        open(url) {
            browser.tabs.create({url});
        },

        openShortcutSettings() {
            browser.runtime.openOptionsPage();
        },

        typeWrap(value) {
            if (typeof value === "boolean") {
                return value ? "On" : "Off";
            }

            return value;
        },

        moveToModuleTab(moduleName) {
            this.tab = 4;

            this.$el.querySelectorAll(".refresher-module.highlight").forEach(v => {
                v.classList.remove("highlight");
            });

            let modules = this.$el.querySelectorAll(".tab .refresher-module .title");

            for (var i = 0; i < modules.length; i++) {
                if (modules[i].innerText === moduleName) {
                    requestAnimationFrame(() => {
                        modules[i].parentElement.parentElement.classList.add("highlight");

                        modules[i].scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                        setTimeout(() => {
                            this.$el
                                .querySelectorAll(".refresher-module.highlight")
                                .forEach(v => {
                                    v.classList.remove("highlight");
                                });
                        }, 1000);
                    });

                    return;
                }
            }
        },

        advancedSettingsCount(obj) {
            return Object.keys(obj).filter(v => obj[v] && obj[v].advanced).length;
        },

        updateUserSetting(module, key, value) {
            this.settings[module][key].value = value;

            port.postMessage({
                updateUserSetting: true,
                name: module,
                key,
                value,
                settings_store: this.settings
            });

            browser.tabs.query({active: true}).then(tabs => {
                browser.tabs.sendMessage(tabs[0].id, {
                    type: "updateSettingValue",
                    data: {
                        name: module,
                        key,
                        value
                    }
                });
            });
        },

        syncBlock() {
            port.postMessage({
                updateBlocks: true,
                blocks_store: this.blocks,
                blockModes_store: this.blockModes
            });

            browser.tabs.query({active: true}).then(tabs => {
                browser.tabs.sendMessage(tabs[0].id, {
                    type: "updateBlocks",
                    data: {
                        blocks: this.blocks,
                        modes: this.blockModes
                    }
                });
            });
        },

        addEmptyBlockedUser(key) {
            if (key === "DCCON") {
                createDCConSelector();

                return;
            }

            let result = prompt(
                `추가할 ${this.blockKeyNames[key]} 값을 입력하세요.`,
                ""
            );

            if (!result || result.length < 1) {
                return;
            }

            this.blocks[key].push({
                content: result
            });
            this.syncBlock();
        },

        removeBlockedUser(key, index) {
            this.blocks[key].splice(index, 1);
            this.syncBlock();
        },

        editBlockedUser(key, index) {
            let result = prompt(
                `바꿀 ${this.blockKeyNames[key]} 값을 입력하세요.`,
                this.blocks[key][index].content
            );

            if (!result || result.length < 1) {
                return;
            }

            if (result !== this.blocks[key][index].content) {
                this.blocks[key][index].extra = "";
            }

            this.blocks[key][index].content = result;
            this.syncBlock();
        },

        syncMemos() {
            port.postMessage({
                updateMemos: true,
                memos_store: this.memos
            });

            browser.tabs.query({active: true}).then(tabs => {
                browser.tabs.sendMessage(tabs[0].id, {
                    type: "updateMemos",
                    data: {
                        memos_store: this.memos
                    }
                });
            });
        },

        removeMemoUser(key) {
            const obj = {...this.memos};
            delete obj[key];
            this.memos = obj;

            this.syncMemos();
        },

        editMemoUser(key) {
            alert("수정 기능은 현재 준비 중입니다.");
        },

        updateDarkMode(v) {
            document.documentElement.classList[v ? "add" : "remove"](
                "refresherDark"
            );
        }
    },

    mounted() {
        port.postMessage({
            requestRefresherModules: true,
            requestRefresherSettings: true,
            requestRefresherBlocks: true,
            requestRefresherMemos: true
        });

        port.onMessage.addListener(msg => {
            if (msg.responseRefresherModules) {
                this.$data.modules = msg.modules || {};
            }

            if (msg.responseRefresherSettings) {
                this.$data.settings = msg.settings || {};
            }

            if (msg.responseRefresherBlocks) {
                this.$data.blocks = msg.blocks || {};
                this.$data.blockModes = msg.blockModes || {};
            }

            if (msg.requestRefresherMemos) {
                this.$data.memos = msg.memos || {};
            }
        });

        browser.commands.getAll().then(cmd => {
            this.shortcuts = cmd;
        });
    },

    watch: {
        modules(modules) {
            if (modules["다크 모드"]) {
                this.updateDarkMode(modules["다크 모드"].enable);
            }
        }
    },

    components: {
        "refresher-checkbox": checkbox,
        "refresher-module": module,
        "refresher-options": options,
        "refresher-input": input,
        "refresher-range": range,
        "refresher-bubble": bubble,
        "refresher-dccon": dccon
    }
};
</script>