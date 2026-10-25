from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from PIL import Image

from backend.config import FONT_BOLD, FONT_REGULAR


def _build_pdf_doc(doc_title: str = "MULTI_TG_TOOL Document"):
    from fpdf import FPDF

    class _NexusPDF(FPDF):
        def __init__(self, title_str: str = "MULTI_TG_TOOL Document") -> None:
            super().__init__()
            self.doc_title = title_str
            self.add_font("DejaVu", style="", fname=FONT_REGULAR)
            self.add_font("DejaVu", style="B", fname=FONT_BOLD)

        def footer(self) -> None:
            self.set_y(-15)
            self.set_font("DejaVu", "", 8)
            self.set_text_color(140, 150, 165)
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            self.cell(0, 10, f"MULTI_TG_TOOL PDF • {ts} • Стр. {self.page_no()}", align="C")

    return _NexusPDF(title_str=doc_title)


def render_text_to_pdf(title: str, content: str, author: str = "MULTI_TG_TOOL") -> bytes:
    body = (content or "").strip()
    if not body:
        raise ValueError("Текст документа не может быть пустым")

    doc_title = (title or "Документ MULTI_TG_TOOL").strip()[:120]
    pdf = _build_pdf_doc(doc_title=doc_title)
    pdf.set_title(doc_title)
    pdf.set_author(author)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # Header accent banner
    pdf.set_fill_color(15, 23, 42)
    pdf.rect(10, 10, 190, 22, style="F")
    pdf.set_xy(15, 15)
    pdf.set_font("DejaVu", "B", 14)
    pdf.set_text_color(248, 250, 252)
    pdf.cell(180, 12, doc_title[:75])

    pdf.set_y(38)
    pdf.set_text_color(30, 41, 59)

    for raw_line in body.splitlines():
        line = raw_line.rstrip()
        if not line:
            pdf.ln(4)
            continue
        if line.startswith("# "):
            pdf.ln(2)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("DejaVu", "B", 15)
            pdf.set_text_color(15, 23, 42)
            pdf.multi_cell(0, 8, line[2:].strip(), new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(30, 41, 59)
            pdf.ln(1)
        elif line.startswith("## "):
            pdf.ln(2)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("DejaVu", "B", 12)
            pdf.set_text_color(37, 99, 235)
            pdf.multi_cell(0, 7, line[3:].strip(), new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(30, 41, 59)
        elif line.startswith(("- ", "* ", "• ")):
            pdf.set_x(pdf.l_margin)
            pdf.set_font("DejaVu", "", 11)
            pdf.multi_cell(0, 6.5, f"  •  {line[2:].strip()}", new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_x(pdf.l_margin)
            pdf.set_font("DejaVu", "", 11)
            pdf.multi_cell(0, 6.5, line, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def images_to_pdf(image_bytes_list: list[bytes]) -> bytes:
    if not image_bytes_list:
        raise ValueError("Не передано ни одного изображения")
    pil_pages: list[Image.Image] = []
    for raw in image_bytes_list:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        pil_pages.append(img)
    buf = io.BytesIO()
    first, rest = pil_pages[0], pil_pages[1:]
    first.save(buf, format="PDF", resolution=150.0, save_all=True, append_images=rest)
    return buf.getvalue()


def inspect_pdf(pdf_bytes: bytes) -> dict[str, Any]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    is_encrypted = reader.is_encrypted
    meta: dict[str, str] = {}
    pages_text: list[dict[str, Any]] = []
    full_text_parts: list[str] = []
    page_count = 0

    if not is_encrypted:
        page_count = len(reader.pages)
        meta_raw = reader.metadata or {}
        for k, v in meta_raw.items():
            if v:
                meta[str(k).lstrip("/")] = str(v)[:120]
        for idx, page in enumerate(reader.pages[:25], start=1):
            txt = (page.extract_text() or "").strip()
            pages_text.append({"page": idx, "chars": len(txt), "preview": txt[:500]})
            if txt:
                full_text_parts.append(f"--- Стр. {idx} ---\n{txt}")

    return {
        "page_count": page_count,
        "is_encrypted": is_encrypted,
        "size_kb": round(len(pdf_bytes) / 1024, 1),
        "metadata": meta,
        "pages": pages_text,
        "extracted_text": "\n\n".join(full_text_parts)[:6000],
    }


def _parse_page_ranges(spec: str, total_pages: int) -> list[int]:
    if not spec.strip():
        return list(range(total_pages))
    indices: list[int] = []
    for part in spec.split(","):
        token = part.strip()
        if not token:
            continue
        if "-" in token:
            a_str, b_str = token.split("-", 1)
            start = max(1, int(a_str.strip()))
            end = min(total_pages, int(b_str.strip()))
            for p in range(start, end + 1):
                if (p - 1) not in indices:
                    indices.append(p - 1)
        else:
            p = int(token)
            if 1 <= p <= total_pages and (p - 1) not in indices:
                indices.append(p - 1)
    if not indices:
        raise ValueError(f"Ни одна страница из диапазона '{spec}' не входит в документ (1..{total_pages})")
    return indices


def transform_pdf(
    pdf_bytes: bytes,
    pages_spec: str = "",
    rotate_deg: int = 0,
    password: str = "",
) -> tuple[bytes, dict[str, Any]]:
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        raise ValueError("Исходный PDF уже зашифрован паролем")

    total = len(reader.pages)
    selected = _parse_page_ranges(pages_spec, total)
    writer = PdfWriter()

    deg = rotate_deg % 360
    if deg not in (0, 90, 180, 270):
        deg = 0

    for idx in selected:
        page = reader.pages[idx]
        if deg:
            page.rotate(deg)
        writer.add_page(page)

    encrypted = False
    if password.strip():
        writer.encrypt(user_password=password.strip(), algorithm="AES-256")
        encrypted = True

    out = io.BytesIO()
    writer.write(out)
    res = out.getvalue()
    return res, {
        "source_pages": total,
        "output_pages": len(selected),
        "rotated": deg,
        "encrypted": encrypted,
        "output_size_kb": round(len(res) / 1024, 1),
    }
