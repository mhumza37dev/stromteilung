import { Skeleton, SkeletonLines } from '../components/ui/Skeleton';

/**
 * Per-screen Suspense fallbacks.
 *
 * Each skeleton mirrors its real screen's *layout* (column widths, card
 * count, nav height) so the transition from skeleton → loaded feels like a
 * fill-in rather than a layout shift. That's the whole point: no flicker,
 * no jump.
 *
 * They render against the same `bg-surface` page color so even the lazy
 * chunk boundary doesn't flash a different background.
 */

function ShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Nav placeholder — matches the real Nav's 60px height + side padding */}
      <div className="h-[60px] bg-white border-b border-gray-200/70 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Skeleton shape="md" width={30} height={30} />
          <Skeleton shape="sm" width={120} height={16} />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton shape="pill" width={56} height={26} />
          <Skeleton shape="circle" width={34} height={34} />
        </div>
      </div>
      {children}
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <ShellSkeleton>
      <div className="flex flex-col items-center px-6 py-[60px]">
        <div className="w-full max-w-[460px] bg-white border border-gray-200/70 rounded-xl p-6">
          <Skeleton shape="md" width="100%" height={48} className="mb-5" />
          <Skeleton shape="sm" width="35%" height={18} className="mb-2.5" />
          <Skeleton shape="md" width="60%" height={24} className="mb-6" />
          <div className="flex flex-col gap-4">
            <div>
              <Skeleton shape="sm" width="30%" height={12} className="mb-1.5" />
              <Skeleton shape="md" width="100%" height={42} />
            </div>
            <div>
              <Skeleton shape="sm" width="30%" height={12} className="mb-1.5" />
              <Skeleton shape="md" width="100%" height={42} />
            </div>
          </div>
          <Skeleton shape="md" width="100%" height={42} className="mt-5" />
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function OnboardingSkeleton() {
  return (
    <ShellSkeleton>
      <div className="flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-[520px]">
          <Skeleton shape="sm" width="40%" height={22} className="mb-7 mx-auto" />
          <div className="flex gap-2 mb-7">
            <Skeleton shape="pill" width="100%" height={4} />
            <Skeleton shape="pill" width="100%" height={4} />
          </div>
          <div className="bg-white border border-gray-200/70 rounded-xl p-6">
            <SkeletonLines count={3} className="mb-5" />
            <Skeleton shape="md" width="100%" height={42} className="mb-3" />
            <Skeleton shape="md" width="100%" height={260} />
          </div>
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function BuyerDashSkeleton() {
  return (
    <ShellSkeleton>
      {/* Location bar */}
      <div className="bg-white border-b border-gray-200/70 px-6 py-3 flex items-center gap-2">
        <Skeleton shape="circle" width={16} height={16} />
        <Skeleton shape="sm" width={240} height={16} />
      </div>

      <div className="max-w-[1100px] mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton shape="sm" width={150} height={14} />
          <div className="flex gap-1.5">
            <Skeleton shape="pill" width={60} height={28} />
            <Skeleton shape="pill" width={80} height={28} />
            <Skeleton shape="pill" width={80} height={28} />
          </div>
        </div>

        {/* Card grid — 4 placeholder cards */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/70 rounded-[14px] overflow-hidden">
              <div className="bg-gradient-to-br from-brand-50 to-brand-100 px-[18px] pt-[18px] pb-3.5 border-b border-gray-200/70">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Skeleton shape="sm" width="80%" height={16} className="mb-2" />
                    <Skeleton shape="sm" width="55%" height={12} />
                  </div>
                  <Skeleton shape="md" width={70} height={42} />
                </div>
              </div>
              <div className="px-[18px] py-3.5">
                <div className="grid grid-cols-3 gap-2 mb-3.5">
                  <Skeleton shape="sm" height={36} />
                  <Skeleton shape="sm" height={36} />
                  <Skeleton shape="sm" height={36} />
                </div>
                <Skeleton shape="sm" width="60%" height={14} className="mb-3.5" />
                <Skeleton shape="md" width="100%" height={36} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function SellerDashSkeleton() {
  return (
    <ShellSkeleton>
      <div className="max-w-[900px] mx-auto px-6 py-7">
        <Skeleton shape="sm" width="35%" height={22} className="mb-1.5" />
        <Skeleton shape="sm" width="55%" height={14} className="mb-7" />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3.5 mb-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/70 rounded-xl px-[18px] py-4">
              <div className="flex justify-between items-start mb-3">
                <Skeleton shape="sm" width="60%" height={12} />
                <Skeleton shape="sm" width={28} height={28} />
              </div>
              <Skeleton shape="sm" width="40%" height={22} />
            </div>
          ))}
        </div>

        {/* Listings */}
        <Skeleton shape="sm" width="20%" height={17} className="mb-3.5" />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/70 rounded-xl px-4 py-3.5 flex items-center gap-3">
              <Skeleton shape="md" width={32} height={32} />
              <div className="flex-1">
                <Skeleton shape="sm" width="50%" height={14} className="mb-2" />
                <Skeleton shape="sm" width="30%" height={12} />
              </div>
              <Skeleton shape="pill" width={60} height={20} />
            </div>
          ))}
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function ProfileSkeleton() {
  return (
    <ShellSkeleton>
      <div className="max-w-[560px] mx-auto px-6 py-[30px]">
        <Skeleton shape="sm" width="40%" height={24} className="mb-6" />
        <div className="bg-white border border-gray-200/70 rounded-xl p-6">
          <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-gray-200/70">
            <Skeleton shape="circle" width={52} height={52} />
            <div className="flex-1">
              <Skeleton shape="sm" width="50%" height={16} className="mb-2" />
              <Skeleton shape="pill" width={60} height={18} />
            </div>
          </div>
          <SkeletonLines count={4} />
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function RatingsSkeleton() {
  return (
    <ShellSkeleton>
      <div className="max-w-[560px] mx-auto px-6 py-[30px]">
        <Skeleton shape="sm" width="40%" height={24} className="mb-6" />
        <div className="bg-white border border-gray-200/70 rounded-xl p-6 mb-4 flex items-center gap-3.5">
          <Skeleton shape="sm" width={60} height={36} />
          <div className="flex-1">
            <Skeleton shape="sm" width="35%" height={14} className="mb-2" />
            <Skeleton shape="sm" width="20%" height={12} />
          </div>
        </div>
        <div className="bg-white border border-gray-200/70 rounded-xl p-6">
          <SkeletonLines count={4} />
        </div>
      </div>
    </ShellSkeleton>
  );
}
