'use client'

import React from 'react'

interface Column {
    header: string;
    key: string;
    render?: (value: any, item: any) => React.ReactNode;
}

interface TableProps {
    columns: Column[];
    data: any[];
    title?: string;
    actions?: (item: any) => React.ReactNode;
}

const Table = ({ columns, data, title, actions }: TableProps) => {
    return (
        <div className="rounded-sm border border-stroke bg-white px-5 pb-2.5 pt-6 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
            {title && (
                <h4 className="mb-6 text-xl font-semibold text-black dark:text-white">
                    {title}
                </h4>
            )}

            <div className="flex flex-col">
                <div className="grid grid-cols-3 rounded-sm bg-gray-2 dark:bg-meta-4 sm:grid-cols-5">
                    {columns.map((col, index) => (
                        <div key={index} className="p-2.5 xl:p-5">
                            <h5 className="text-sm font-medium uppercase xsm:text-base">
                                {col.header}
                            </h5>
                        </div>
                    ))}
                    {actions && (
                        <div className="p-2.5 text-center xl:p-5">
                            <h5 className="text-sm font-medium uppercase xsm:text-base">
                                Actions
                            </h5>
                        </div>
                    )}
                </div>

                {data.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">No records found.</div>
                ) : (
                    data.map((item, key) => (
                        <div
                            className={`grid grid-cols-3 sm:grid-cols-5 ${key === data.length - 1
                                    ? ''
                                    : 'border-b border-stroke dark:border-strokedark'
                                }`}
                            key={key}
                        >
                            {columns.map((col, index) => (
                                <div key={index} className="flex items-center gap-3 p-2.5 xl:p-5">
                                    <p className="text-black dark:text-white">
                                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                                    </p>
                                </div>
                            ))}

                            {actions && (
                                <div className="flex items-center justify-center p-2.5 xl:p-5">
                                    {actions(item)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default Table
