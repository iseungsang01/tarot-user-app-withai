"""카드 아트 에셋 최적화.

`assets/card-original/*.png` (1024x1536 PNG 원본) 를 읽어 두 벌을 만든다.

  - `assets/card/*.webp`       800x1200  확대 모달(260x390dp @3x)·결과 카드용
  - `assets/card-thumb/*.webp` 240x360   티켓 화면 스탬프 슬롯(약 66x97dp)용

썸네일을 따로 두는 이유는 파일 크기가 아니라 **런타임 메모리**다. 스탬프 그리드는
카드 10장을 한 화면에 동시에 띄우는데, 디코딩된 비트맵은 포맷과 무관하게
`가로 x 세로 x 4바이트`를 차지한다. 원본 해상도면 장당 6.3MB라 화면 하나가
63MB를 잡아먹는다. 240x360 이면 장당 0.35MB로 떨어진다.

원본과 파생물 모두 `.gitignore` 대상이라 저장소에는 없다. 카드 아트를 교체하면
`assets/card-original/` 에 새 PNG 를 넣고 이 스크립트를 다시 돌리면 된다.

사용법:  python scripts/optimize-card-assets.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "assets" / "card-original"
FULL_DIR = ROOT / "assets" / "card"
THUMB_DIR = ROOT / "assets" / "card-thumb"

# (출력 디렉터리, 해상도, WebP 품질)
VARIANTS = [
    (FULL_DIR, (800, 1200), 85),
    (THUMB_DIR, (240, 360), 88),
]


def optimize() -> None:
    sources = sorted(SOURCE_DIR.glob("*.png"))
    if not sources:
        raise SystemExit(f"원본 PNG 가 없습니다: {SOURCE_DIR}")

    for target_dir, size, quality in VARIANTS:
        target_dir.mkdir(parents=True, exist_ok=True)

    total_before = 0
    total_after = 0

    for source in sources:
        total_before += source.stat().st_size
        with Image.open(source) as image:
            rgb = image.convert("RGB")
            for target_dir, size, quality in VARIANTS:
                target = target_dir / f"{source.stem}.webp"
                rgb.resize(size, Image.LANCZOS).save(
                    target, "WEBP", quality=quality, method=6
                )
                total_after += target.stat().st_size

        print(f"  {source.name}")

    print(
        f"\n{len(sources)}장: {total_before / 1024 / 1024:.1f}MB"
        f" -> {total_after / 1024 / 1024:.1f}MB"
    )


if __name__ == "__main__":
    optimize()
