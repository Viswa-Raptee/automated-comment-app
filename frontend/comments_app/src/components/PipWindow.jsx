import { useState, useEffect } from 'react';
import { Play, X, Move } from 'lucide-react';

const PipWindow = ({ post, onClose, platform }) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: window.innerHeight - 250 });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    setIsDragging(true);
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - rel.x,
      y: e.clientY - rel.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="fixed w-80 bg-black rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-700" style={{ left: position.x, top: position.y }}>
      <div onMouseDown={handleMouseDown} className="flex justify-between items-center p-2 bg-gray-900 text-white cursor-move select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <Move size={12} className="text-gray-500" />
          <span className="text-xs font-medium truncate flex-1">{post.postTitle}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="aspect-video bg-black flex items-center justify-center relative">
        {platform === 'youtube' ? (
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${post.postId}?autoplay=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          post.mediaUrl && !post.mediaUrl.includes('placeholder') ? (
            <video src={post.mediaUrl} controls autoPlay className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-gray-500">
              <Play size={32} />
              <span className="mt-2 text-xs">Video Unavailable</span>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PipWindow;
