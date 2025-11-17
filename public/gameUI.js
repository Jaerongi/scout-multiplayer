// ================================
// GAME UI FINAL — FIXED VERSION
// ================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// ===============================
// 상태 변수
// ===============================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let flipConfirmed = false;   // 내가 방향 확정
