import os
import zipfile
import xml.etree.ElementTree as ET

def load_epub(epub_path):
    """
    Unzips the EPUB container, parses the OPF manifest/spine,
    and returns metadata along with spine HTML/XHTML documents.
    """
    book_filename = os.path.basename(epub_path)
    try:
        with zipfile.ZipFile(epub_path, 'r') as epub:
            container_data = epub.read('META-INF/container.xml')
            root = ET.fromstring(container_data)
            rootfile = root.find('.//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile')
            opf_path = rootfile.attrib['full-path']
            opf_dir = os.path.dirname(opf_path)
            
            opf_data = epub.read(opf_path)
            opf_xml = ET.fromstring(opf_data)
            
            ns = {
                'opf': 'http://www.idpf.org/2007/opf',
                'dc': 'http://purl.org/dc/elements/1.1/'
            }
            
            metadata = opf_xml.find('opf:metadata', ns)
            title = metadata.find('dc:title', ns).text if metadata.find('dc:title', ns) is not None else "Unknown Book"
            author = metadata.find('dc:creator', ns).text if metadata.find('dc:creator', ns) is not None else "Zenva"
            
            manifest = opf_xml.find('opf:manifest', ns)
            items = {item.attrib['id']: item.attrib['href'] for item in manifest.findall('opf:item', ns)}
            
            spine = opf_xml.find('opf:spine', ns)
            spine_items = [items[itemref.attrib['idref']] for itemref in spine.findall('opf:itemref', ns)]
            
            html_documents = []
            for href in spine_items:
                href_lower = href.lower()
                if not (href_lower.endswith('.xhtml') or href_lower.endswith('.html') or href_lower.endswith('.htm')):
                    continue
                if 'cover' in href_lower or 'toc' in href_lower or 'tableofcontents' in href_lower:
                    continue
                    
                full_href = os.path.normpath(os.path.join(opf_dir, href)) if opf_dir else href
                try:
                    html_content = epub.read(full_href).decode('utf-8', errors='ignore')
                    html_documents.append((href, html_content))
                except Exception as e:
                    print(f"    Warning: Failed to read spine item {href}: {e}")
                    
            return {
                "book": {
                    "id": book_filename.split('.')[0],
                    "title": title,
                    "author": author,
                    "file": book_filename
                },
                "html_documents": html_documents
            }
    except Exception as e:
        print(f"Error loading EPUB {book_filename}: {e}")
        return None
