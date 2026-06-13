import logging
from pathlib import Path
from typing import Optional
import pypdf

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads/guides")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def extract_text_from_pdf(file_path: str) -> Optional[str]:
    """PDF 파일에서 텍스트 추출"""
    try:
        reader = pypdf.PdfReader(file_path)
        text_parts = []
        
        for page_num, page in enumerate(reader.pages, 1):
            text = page.extract_text()
            if text.strip():
                text_parts.append(f"## 페이지 {page_num}\n\n{text}\n")
        
        full_text = "\n".join(text_parts)
        logger.info(f"PDF 텍스트 추출 완료: {len(full_text)} 문자")
        return full_text
    
    except Exception as exc:
        logger.error(f"PDF 텍스트 추출 실패: {exc}")
        return None


def save_uploaded_file(file_content: bytes, filename: str) -> str:
    """업로드된 파일 저장"""
    import hashlib
    from datetime import datetime
    
    # 파일명 중복 방지 (해시 + 타임스탬프)
    file_hash = hashlib.md5(file_content).hexdigest()[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file_hash}_{filename}"
    
    file_path = UPLOAD_DIR / safe_filename
    file_path.write_bytes(file_content)
    
    logger.info(f"파일 저장 완료: {file_path}")
    return str(file_path)
