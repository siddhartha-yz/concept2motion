"""Serve only files referenced by a prepared evidence viewer on localhost."""
import argparse
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
from urllib.parse import unquote,urlsplit
from build_pilot_view import ROOT,local_path


def evidence_files(directory):
    directory=local_path(directory)
    data=json.loads((directory/'evidence.json').read_text())
    files={directory/'index.html',directory/'evidence.json',directory/'manifest.json'}
    for group in data['groups']:
        for candidate in group['candidates']:
            for field in ('video','contact','source','checks'):
                if candidate.get(field):
                    path=(directory/candidate[field]).resolve()
                    if not path.is_relative_to(ROOT):raise ValueError('Viewer resource leaves workspace')
                    if path.is_file():files.add(path)
    return directory,files


def handler(directory,files):
    class Viewer(BaseHTTPRequestHandler):
        def do_HEAD(self):self.serve(False)
        def do_GET(self):self.serve(True)
        def log_message(self,*args):pass
        def serve(self,body):
            route=unquote(urlsplit(self.path).path)
            path=directory/'index.html' if route=='/' else (ROOT/route.lstrip('/')).resolve()
            if path not in files:
                self.send_error(404);return
            data=path.read_bytes();start,end=0,len(data)-1;status=200
            requested=self.headers.get('Range')
            if requested:
                try:
                    if not requested.startswith('bytes=') or ',' in requested:raise ValueError()
                    first,last=requested[6:].split('-',1)
                    if first:start=int(first);end=int(last) if last else end
                    else:start=max(0,len(data)-int(last))
                    if start<0 or start>=len(data) or end<start:raise ValueError()
                    end=min(end,len(data)-1);status=206
                except (ValueError,TypeError):
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{len(data)}');self.end_headers();return
            self.send_response(status)
            media='text/plain; charset=utf-8' if path.suffix in ('.js','.mjs') else mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            self.send_header('Content-Type',media);self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes')
            self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'")
            if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{len(data)}')
            self.end_headers()
            if body:
                try:self.wfile.write(data[start:end+1])
                except (BrokenPipeError,ConnectionResetError):pass
    return Viewer


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--view',required=True);parser.add_argument('--port',type=int,default=8789);args=parser.parse_args()
    directory,files=evidence_files(args.view);server=ThreadingHTTPServer(('127.0.0.1',args.port),handler(directory,files))
    print(f'http://127.0.0.1:{server.server_address[1]}/{directory.relative_to(ROOT)}/index.html · {len(files)} permitted evidence files',flush=True)
    server.serve_forever()
