
import React from 'react';

const Statistics: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-700">
      <div className="flex-1 relative w-full h-full min-h-[600px]">
        <iframe 
          title="Relatório de Notas e Pedidos"
          width="100%" 
          height="100%" 
          src="https://app.powerbi.com/view?r=eyJrIjoiZWVjMjdiNmYtYTIxNy00MmVkLWI2YmQtNTIzYmNkZGVlMDJjIiwidCI6IjdkOTc1NGIzLWRjZGItNGVmZS04YmI3LWMwZTU1ODdiODZlZCJ9" 
          frameBorder="0" 
          allowFullScreen={true}
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
      
      {/* Footer informativo opcional para contexto visual do App */}
      <div className="bg-gray-50 px-8 py-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">
          Relatórios Gerenciais em Tempo Real
        </span>
        <div className="flex items-center space-x-2">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Conectado ao Cloud Data</span>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
