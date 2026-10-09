# DentPhoto · 달빛의 받아치기

박선규가 올린 `action.zip`을 풀어 넣은 횡스크롤 액션 로그라이트다. 캔버스 하나에 그리는 순수 JavaScript 게임이고, 그림 아틀라스 4장(`assets/`)을 쓴다.

플레이: https://iontiger.github.io/Caf/ (사이트 첫 화면. master에 머지되면 GitHub Actions가 자동 배포)

## 빌드와 테스트

```bash
cd moonlight
node tests/game.test.cjs   # 규칙 테스트 18개와 모의 플레이(1막 12판, 2막 8판)
python3 build.py           # 그림을 넣은 단일 파일 DentPhoto-Action.html 생성
```

`DentPhoto-Action.html`은 빌드 결과라 저장소에 넣지 않는다. 배포할 때 워크플로가 만들어 사이트의 `index.html`로 올린다.

- `src/index.html`, `src/style.css`, `src/game.js`: 화면 틀, 스타일, 게임 코드. `build.py`가 셋과 그림을 한 파일로 합친다.
- `assets/atlas-frames.json`: 아틀라스 안 그림의 위치. `analyze_atlas.py`(Pillow 필요)로 다시 만든다.
- `assets/title.jpg`: 시작 화면 그림. 박선규가 처음에 올린 타이틀 이미지를 JPEG로 줄였다.
- `combat-preview.jpg`: 전투 화면 미리보기

## 2막: 절벽 지붕길

초기 화면의 `2막 · 절벽 지붕길` 버튼이나 술집의 지붕길 문에서 바로 시작한다. 1막에서 브락을 이기면 그대로 이어서 올라갈 수도 있다. 지붕 8방(4번째 방은 거울 마술사 미라주, 7번째는 상인), 보스는 시계탑의 시계 정비사 정각이다.

- `assets/act2-enemies.webp`: 주전자 할머니, 우편배달부, 밧줄 선원, 약병 사진사, 거울 마술사, 시계 정비사의 대기·이동·공격·피격·쓰러짐 각 4장
- `assets/hero-motion.webp`: 아울러의 달리기 6장, 점프 6장, 밧줄 오르기 12장. 칼을 쓰는 동작은 기존 아틀라스를 그대로 쓴다
- `assets/act2-frames.json`: 두 그림 안의 위치와 발 기준점
- `assets/cliffs.webp`: 2막 배경. 박선규가 올린 달밤의 절벽 그림을 webp로 줄였다

세 파일은 박선규가 올린 원본에서 `pack_act2.py`로 만든다(Pillow, numpy, scipy 필요).

```bash
python3 pack_act2.py <enemy-atlases 폴더> <hero-motion24.png>
```
