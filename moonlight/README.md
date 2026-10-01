# DentPhoto · 달빛의 받아치기

박선규가 올린 `action.zip`을 풀어 넣은 횡스크롤 액션 로그라이트다. 캔버스 하나에 그리는 순수 JavaScript 게임이고, 그림 아틀라스 4장(`assets/`)을 쓴다.

플레이: https://iontiger.github.io/Caf/ (사이트 첫 화면. master에 머지되면 GitHub Actions가 자동 배포)

## 빌드와 테스트

```bash
cd moonlight
node tests/game.test.cjs   # 규칙 테스트 12개와 모의 플레이
python3 build.py           # 그림을 넣은 단일 파일 DentPhoto-Action.html 생성
```

`DentPhoto-Action.html`은 빌드 결과라 저장소에 넣지 않는다. 배포할 때 워크플로가 만들어 사이트의 `index.html`로 올린다.

- `src/index.html`, `src/style.css`, `src/game.js`: 화면 틀, 스타일, 게임 코드. `build.py`가 셋과 그림을 한 파일로 합친다.
- `assets/atlas-frames.json`: 아틀라스 안 그림의 위치. `analyze_atlas.py`(Pillow 필요)로 다시 만든다.
- `combat-preview.jpg`: 전투 화면 미리보기
